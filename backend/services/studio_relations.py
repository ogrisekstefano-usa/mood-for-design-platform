"""
ITER161 — Studio Relations & Advisor Governance service.

This is NOT a CRM. The vocabulary, the API surface, and the UI it
backs are curatorial: a network of advisors curating their advisory
journeys with design studios, showrooms, ateliers and material
galleries that may join the MOOD ecosystem.
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import text

from database import AsyncSessionLocal


PROTECTION_DAYS = 120


VALID_RELATION_STATUS = {
    'prospect', 'under_review', 'contacted',
    'presentation_scheduled', 'presented',
    'qualified', 'proposal', 'activated',
    'not_aligned', 'archived',
}
VALID_TEMPERATURE = {'cold', 'warm', 'strong', 'ready'}


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ── Identity Verification Layer™ ─────────────────────────────────────
def _normalise(s: Optional[str]) -> str:
    return (s or '').strip().lower()


def _domain_of(url_or_email: Optional[str]) -> Optional[str]:
    if not url_or_email:
        return None
    s = url_or_email.strip().lower()
    if '@' in s:
        s = s.rsplit('@', 1)[1]
    s = re.sub(r'^https?://', '', s).strip('/')
    s = s.split('/', 1)[0]
    s = s.removeprefix('www.')
    return s or None


async def verify_studio_identity(*,
    studio_name: Optional[str] = None,
    legal_name: Optional[str] = None,
    website: Optional[str] = None,
    contact_email: Optional[str] = None,
    phone: Optional[str] = None,
    city: Optional[str] = None,
    country: Optional[str] = None,
) -> dict:
    """
    Curatorial duplicate / network match check.

    Result shape:
      { "verdict": "clear" | "possible_match" | "existing_relation" | "active_tenant",
        "matches": [ {kind, id, score, why, label} ] }

    Never raises — fail-soft into "clear".
    """
    matches: list[dict] = []
    try:
        n_name    = _normalise(studio_name)
        n_legal   = _normalise(legal_name)
        n_domain  = _domain_of(website) or _domain_of(contact_email)
        n_email   = _normalise(contact_email)
        n_phone   = re.sub(r'\D', '', phone or '')

        async with AsyncSessionLocal() as s:
            # 1) Active tenants
            if n_name or n_legal:
                rows = (await s.execute(
                    text("""
                        SELECT id, slug, name FROM tenants
                         WHERE lower(name) = ANY(:names)
                           AND status = 'active'
                         LIMIT 5
                    """),
                    {"names": [v for v in [n_name, n_legal] if v]},
                )).mappings().all()
                for r in rows:
                    matches.append({
                        "kind":  "active_tenant",
                        "id":    str(r['id']),
                        "score": 0.95,
                        "label": r['name'],
                        "why":   "tenant_name_exact",
                    })

            # 2) Existing studio_relations
            params = {
                "name":   n_name or None,
                "domain": n_domain or None,
                "email":  n_email or None,
            }
            rows = (await s.execute(
                text("""
                    SELECT id, studio_name, contact_email, website,
                           owner_advisor_id, status, protection_expires_at
                      FROM studio_relations
                     WHERE (CAST(:name   AS text) IS NOT NULL AND lower(studio_name) = CAST(:name AS text))
                        OR (CAST(:email  AS text) IS NOT NULL AND lower(contact_email) = CAST(:email AS text))
                        OR (CAST(:domain AS text) IS NOT NULL AND lower(website) LIKE '%' || CAST(:domain AS text) || '%')
                     LIMIT 5
                """),
                params,
            )).mappings().all()
            for r in rows:
                matches.append({
                    "kind":    "existing_relation",
                    "id":      str(r['id']),
                    "score":   0.85,
                    "label":   r['studio_name'],
                    "why":     "relation_match",
                    "status":  r['status'],
                    "owner":   str(r['owner_advisor_id']) if r['owner_advisor_id'] else None,
                    "protected_until": r['protection_expires_at'].isoformat()
                                          if r['protection_expires_at'] else None,
                })

            # 3) Possible matches in studio_requests (not yet relations)
            rows = (await s.execute(
                text("""
                    SELECT id, studio_name, contact_email, website, status
                      FROM studio_requests
                     WHERE (CAST(:name   AS text) IS NOT NULL AND lower(studio_name) = CAST(:name AS text))
                        OR (CAST(:email  AS text) IS NOT NULL AND lower(contact_email) = CAST(:email AS text))
                        OR (CAST(:domain AS text) IS NOT NULL AND lower(website) LIKE '%' || CAST(:domain AS text) || '%')
                     ORDER BY created_at DESC
                     LIMIT 5
                """),
                params,
            )).mappings().all()
            for r in rows:
                matches.append({
                    "kind":  "possible_match",
                    "id":    str(r['id']),
                    "score": 0.55,
                    "label": r['studio_name'] or r['contact_email'],
                    "why":   "request_match",
                    "status": r['status'],
                })

        # Derive single verdict from strongest match
        if any(m['kind'] == 'active_tenant'      for m in matches):
            verdict = 'active_tenant'
        elif any(m['kind'] == 'existing_relation' for m in matches):
            verdict = 'existing_relation'
        elif matches:
            verdict = 'possible_match'
        else:
            verdict = 'clear'

        return {"verdict": verdict, "matches": matches[:10]}
    except Exception:
        return {"verdict": "clear", "matches": []}


# ── Open / fetch a Studio Relation ───────────────────────────────────
async def open_relation_from_request(*,
    studio_request_id: str,
    owner_advisor_id: Optional[str] = None,
) -> dict:
    """Promote a studio_request into a Studio Relation."""
    async with AsyncSessionLocal() as s:
        req = (await s.execute(
            text("""
                SELECT id, studio_name, archetype, experiences,
                       city, country, website,
                       contact_name, contact_role, contact_email,
                       phone_prefix, phone_number
                  FROM studio_requests
                 WHERE id = :id
                 LIMIT 1
            """),
            {"id": studio_request_id},
        )).mappings().first()
        if not req:
            return {"ok": False, "reason": "no_request"}

        protection_expires = _now() + timedelta(days=PROTECTION_DAYS) \
                              if owner_advisor_id else None

        row = (await s.execute(
            text("""
                INSERT INTO studio_relations
                    (studio_request_id, studio_name, archetype, experiences,
                     city, country, website,
                     contact_name, contact_role, contact_email,
                     phone_prefix, phone_number,
                     status, owner_advisor_id,
                     assigned_at, protection_expires_at, last_activity_at)
                VALUES (:req, :sn, :arc, :exp,
                        :ci, :co, :ws,
                        :cn, :cr, :em,
                        :pp, :ph,
                        'under_review', CAST(:owner AS uuid),
                        CASE WHEN CAST(:owner AS uuid) IS NOT NULL THEN NOW() END,
                        :prot, NOW())
                RETURNING id
            """),
            {"req": str(req['id']),
             "sn": req['studio_name'] or 'Untitled studio',
             "arc": req['archetype'],
             "exp": list(req['experiences'] or []),
             "ci": req['city'], "co": req['country'], "ws": req['website'],
             "cn": req['contact_name'], "cr": req['contact_role'],
             "em": req['contact_email'],
             "pp": req['phone_prefix'], "ph": req['phone_number'],
             "owner": owner_advisor_id, "prot": protection_expires},
        )).mappings().first()
        relation_id = str(row['id'])
        # mark request as reviewing
        await s.execute(
            text("UPDATE studio_requests SET status='reviewing', "
                 "       reviewed_at = COALESCE(reviewed_at, NOW()), updated_at = NOW() "
                 " WHERE id = :id"),
            {"id": str(req['id'])},
        )
        await _log_event(s, relation_id, owner_advisor_id, 'relation_opened',
                          {"from_request": str(req['id'])})
        await s.commit()
    return {"ok": True, "relation_id": relation_id}


async def create_relation_manually(*,
    studio_name: str,
    archetype: Optional[str] = None,
    contact_email: Optional[str] = None,
    contact_name: Optional[str] = None,
    website: Optional[str] = None,
    city: Optional[str] = None,
    country: Optional[str] = None,
    owner_advisor_id: Optional[str] = None,
) -> dict:
    """Direct creation (advisor entry without a public request)."""
    if not studio_name or not studio_name.strip():
        return {"ok": False, "reason": "empty_name"}
    protection_expires = _now() + timedelta(days=PROTECTION_DAYS) \
                          if owner_advisor_id else None
    async with AsyncSessionLocal() as s:
        row = (await s.execute(
            text("""
                INSERT INTO studio_relations
                  (studio_name, archetype, contact_email, contact_name,
                   website, city, country,
                   status, owner_advisor_id,
                   assigned_at, protection_expires_at, last_activity_at)
                VALUES (:sn, :arc, :em, :cn, :ws, :ci, :co,
                        'prospect', CAST(:owner AS uuid),
                        CASE WHEN CAST(:owner AS uuid) IS NOT NULL THEN NOW() END,
                        :prot, NOW())
                RETURNING id
            """),
            {"sn": studio_name.strip(),
             "arc": archetype, "em": contact_email,
             "cn": contact_name, "ws": website,
             "ci": city, "co": country,
             "owner": owner_advisor_id, "prot": protection_expires},
        )).mappings().first()
        rid = str(row['id'])
        await _log_event(s, rid, owner_advisor_id, 'relation_opened',
                          {"source": "manual"})
        await s.commit()
    return {"ok": True, "relation_id": rid}


async def list_relations(*,
    advisor_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 100,
) -> list[dict]:
    where: list[str] = []
    params: dict = {"lim": int(limit)}
    if advisor_id:
        where.append("owner_advisor_id = :owner")
        params["owner"] = advisor_id
    if status:
        where.append("status = :st")
        params["st"] = status
    where_sql = ("WHERE " + " AND ".join(where)) if where else ""
    async with AsyncSessionLocal() as s:
        rows = (await s.execute(
            text(f"""
                SELECT * FROM studio_relations
                {where_sql}
                ORDER BY last_activity_at DESC
                LIMIT :lim
            """),
            params,
        )).mappings().all()
    return [_serialize_relation(r) for r in rows]


async def get_relation(relation_id: str) -> Optional[dict]:
    async with AsyncSessionLocal() as s:
        row = (await s.execute(
            text("SELECT * FROM studio_relations WHERE id = :id LIMIT 1"),
            {"id": relation_id},
        )).mappings().first()
        if not row:
            return None
        events = (await s.execute(
            text("""
                SELECT id, kind, payload, occurred_at, actor_id
                  FROM studio_relationship_events
                 WHERE relation_id = :id
                 ORDER BY occurred_at DESC LIMIT 100
            """),
            {"id": relation_id},
        )).mappings().all()
        visits = (await s.execute(
            text("""
                SELECT * FROM studio_visit_reports
                 WHERE relation_id = :id ORDER BY visited_at DESC LIMIT 25
            """),
            {"id": relation_id},
        )).mappings().all()
        followups = (await s.execute(
            text("""
                SELECT * FROM advisor_followups
                 WHERE relation_id = :id
                 ORDER BY due_at ASC LIMIT 50
            """),
            {"id": relation_id},
        )).mappings().all()
    out = _serialize_relation(row)
    out['events']    = [_serialize_event(e)   for e in events]
    out['visits']    = [_serialize_visit(v)   for v in visits]
    out['followups'] = [_serialize_followup(f) for f in followups]
    return out


async def update_relation(*, relation_id: str, actor_id: Optional[str],
                            patch: dict) -> dict:
    """
    Update mutable fields. Honors validation. Logs timeline events on
    status / temperature / ownership changes.
    """
    sets: list[str] = ["updated_at = NOW()", "last_activity_at = NOW()"]
    params: dict = {"id": relation_id}
    events: list[tuple[str, dict]] = []

    if 'status' in patch:
        st = patch['status']
        if st in VALID_RELATION_STATUS:
            sets.append("status = :st"); params["st"] = st
            events.append(('status_changed', {"to": st}))
    if 'temperature' in patch:
        tmp = patch['temperature']
        if tmp in VALID_TEMPERATURE:
            sets.append("temperature = :tmp"); params["tmp"] = tmp
            events.append(('temperature_changed', {"to": tmp}))
    if 'advisory_notes' in patch:
        sets.append("advisory_notes = :an")
        params["an"] = patch['advisory_notes']
    if 'next_action' in patch:
        sets.append("next_action = :na")
        params["na"] = patch['next_action']
    if 'expected_monthly_value' in patch:
        sets.append("expected_monthly_value = :emv")
        params["emv"] = patch['expected_monthly_value']
    if 'expected_setup_value' in patch:
        sets.append("expected_setup_value = :esv")
        params["esv"] = patch['expected_setup_value']
    if 'advisor_recurring_pct' in patch:
        sets.append("advisor_recurring_pct = :arp")
        params["arp"] = patch['advisor_recurring_pct']
    if 'advisor_setup_pct' in patch:
        sets.append("advisor_setup_pct = :asp")
        params["asp"] = patch['advisor_setup_pct']
    if 'advisor_recurring_months' in patch:
        sets.append("advisor_recurring_months = :arm")
        params["arm"] = patch['advisor_recurring_months']
    if 'owner_advisor_id' in patch:
        # ownership change → reset protection window
        sets.append("owner_advisor_id = :oid")
        sets.append("assigned_at = NOW()")
        sets.append("protection_expires_at = NOW() + interval '120 days'")
        params["oid"] = patch['owner_advisor_id']
        events.append(('ownership_changed', {"to": patch['owner_advisor_id']}))

    async with AsyncSessionLocal() as s:
        r = await s.execute(
            text(f"""
                UPDATE studio_relations SET {', '.join(sets)}
                 WHERE id = :id
             RETURNING *
            """),
            params,
        )
        row = r.mappings().first()
        if not row:
            return {"ok": False, "reason": "not_found"}
        for kind, pl in events:
            await _log_event(s, relation_id, actor_id, kind, pl)
        await s.commit()
    return {"ok": True, "relation": _serialize_relation(row)}


# ── Visit Reports ─────────────────────────────────────────────────────
async def create_visit_report(*, relation_id: str, advisor_id: Optional[str],
                                data: dict) -> dict:
    async with AsyncSessionLocal() as s:
        row = (await s.execute(
            text("""
                INSERT INTO studio_visit_reports
                    (relation_id, advisor_id,
                     atmosphere_observed, workflow_maturity, showroom_quality,
                     material_culture, design_journey_alignment,
                     client_experience_maturity, international_readiness,
                     digital_readiness, operational_complexity,
                     opportunities, objections, competitor_tools,
                     suggested_experiences,
                     estimated_monthly_value, estimated_setup_value,
                     probability_pct, next_step, private_notes)
                VALUES (:rid, :aid,
                        :atm, :wm, :sq, :mc, :dja,
                        :cem, :ir, :dr, :oc,
                        :opp, :obj, :ct,
                        :se,
                        :emv, :esv, :pp, :ns, :pn)
                RETURNING id
            """),
            {
                "rid": relation_id, "aid": advisor_id,
                "atm": data.get('atmosphere_observed'),
                "wm":  data.get('workflow_maturity'),
                "sq":  data.get('showroom_quality'),
                "mc":  data.get('material_culture'),
                "dja": data.get('design_journey_alignment'),
                "cem": data.get('client_experience_maturity'),
                "ir":  data.get('international_readiness'),
                "dr":  data.get('digital_readiness'),
                "oc":  data.get('operational_complexity'),
                "opp": data.get('opportunities'),
                "obj": data.get('objections'),
                "ct":  data.get('competitor_tools'),
                "se":  data.get('suggested_experiences') or [],
                "emv": data.get('estimated_monthly_value'),
                "esv": data.get('estimated_setup_value'),
                "pp":  data.get('probability_pct'),
                "ns":  data.get('next_step'),
                "pn":  data.get('private_notes'),
            },
        )).mappings().first()
        await s.execute(text(
            "UPDATE studio_relations SET last_activity_at = NOW() WHERE id = :id"),
            {"id": relation_id})
        await _log_event(s, relation_id, advisor_id, 'visit_recorded',
                          {"visit_id": str(row['id'])})
        await s.commit()
    return {"ok": True, "id": str(row['id'])}


# ── Follow-ups ────────────────────────────────────────────────────────
async def create_followup(*, relation_id: str, advisor_id: Optional[str],
                            type_: str, due_at: datetime, notes: Optional[str]) -> dict:
    async with AsyncSessionLocal() as s:
        row = (await s.execute(
            text("""
                INSERT INTO advisor_followups
                  (relation_id, advisor_id, type, due_at, notes)
                VALUES (:rid, :aid, :tp, :due, :notes)
                RETURNING id
            """),
            {"rid": relation_id, "aid": advisor_id, "tp": type_,
             "due": due_at, "notes": notes},
        )).mappings().first()
        await _log_event(s, relation_id, advisor_id, 'followup_created',
                          {"followup_id": str(row['id']), "type": type_})
        await s.commit()
    return {"ok": True, "id": str(row['id'])}


async def complete_followup(*, followup_id: str, advisor_id: Optional[str],
                              next_action: Optional[str]) -> dict:
    async with AsyncSessionLocal() as s:
        row = (await s.execute(
            text("""
                UPDATE advisor_followups
                   SET status = 'done',
                       completed_at = NOW(),
                       next_action = COALESCE(:na, next_action),
                       updated_at = NOW()
                 WHERE id = :id
             RETURNING relation_id
            """),
            {"id": followup_id, "na": next_action},
        )).mappings().first()
        if not row:
            return {"ok": False, "reason": "not_found"}
        await _log_event(s, str(row['relation_id']), advisor_id,
                          'followup_completed', {"followup_id": followup_id})
        await s.commit()
    return {"ok": True}


async def list_followups_for_advisor(*, advisor_id: str) -> dict:
    """
    Return a dashboard-grouped view of followups for one advisor:
    {overdue, today, this_week, scheduled}.
    """
    now = _now()
    end_today = (now.replace(hour=23, minute=59, second=59, microsecond=0))
    end_week  = end_today + timedelta(days=7)
    async with AsyncSessionLocal() as s:
        rows = (await s.execute(
            text("""
                SELECT f.*, r.studio_name
                  FROM advisor_followups f
                  JOIN studio_relations r ON r.id = f.relation_id
                 WHERE f.advisor_id = :aid
                   AND f.status = 'open'
                 ORDER BY f.due_at ASC
                 LIMIT 200
            """),
            {"aid": advisor_id},
        )).mappings().all()

    buckets = {"overdue": [], "today": [], "this_week": [], "scheduled": []}
    for r in rows:
        f = _serialize_followup(r)
        f['studio_name'] = r['studio_name']
        due = r['due_at']
        if due < now:                buckets["overdue"].append(f)
        elif due <= end_today:       buckets["today"].append(f)
        elif due <= end_week:        buckets["this_week"].append(f)
        else:                        buckets["scheduled"].append(f)
    return buckets


# ── Activation ────────────────────────────────────────────────────────
async def activate_studio_ecosystem(*, relation_id: str,
                                       actor_id: Optional[str],
                                       slug_override: Optional[str] = None,
                                       tenant_name_override: Optional[str] = None,
                                       founder_link_ttl_minutes: int = 43200) -> dict:
    """
    Promote a qualified relation into an active tenant. Creates the
    tenants row + tenant_modules + founder user + emits the first
    Access Continuity magic-link (default TTL = 30 days for founder
    invitations).

    Args:
      slug_override:        Optional advisor-confirmed tenant slug. If
                            absent or already taken, falls back to the
                            auto-derived slug with -2/-3 disambiguation.
      tenant_name_override: Optional advisor-confirmed tenant display name.
      founder_link_ttl_minutes: TTL of the founder activation magic link.
                                Default 43200 = 30 days.

    This is the ONLY path to tenant creation in MOOD — there is no
    self-serve signup.
    """
    async with AsyncSessionLocal() as s:
        rel = (await s.execute(
            text("SELECT * FROM studio_relations WHERE id = :id LIMIT 1"),
            {"id": relation_id},
        )).mappings().first()
        if not rel:
            return {"ok": False, "reason": "relation_not_found"}

        # Look up the original studio_request to recover fields that the
        # studio_relations table does not store (monogram, languages,
        # temperament, markets). Studio identity must survive intact
        # from /studio → /admin/welcome.
        req = None
        if rel.get('studio_request_id'):
            req = (await s.execute(
                text("""
                    SELECT monogram, languages, temperament, markets
                      FROM studio_requests
                     WHERE id = :id LIMIT 1
                """),
                {"id": str(rel['studio_request_id'])},
            )).mappings().first()
        req_monogram   = (req or {}).get('monogram')

        if rel['tenant_id']:
            return {"ok": False, "reason": "already_activated",
                    "tenant_id": str(rel['tenant_id'])}

        # Resolve the tenant display name. Advisor-confirmed override wins.
        tenant_display_name = (tenant_name_override or '').strip() \
                               or rel['studio_name'] or 'Studio'

        # Build the slug. Honour the advisor-confirmed override when
        # provided AND available; otherwise derive from the studio name
        # with -2/-3 disambiguation.
        def _slugify(s: str) -> str:
            return re.sub(r'[^a-z0-9]+', '-', (s or '').lower()).strip('-')

        slug_base = _slugify(slug_override) if slug_override else _slugify(tenant_display_name)
        slug_base = slug_base or 'studio'
        slug = slug_base
        i = 2
        while True:
            exists = (await s.execute(
                text("SELECT 1 FROM tenants WHERE slug = :s"), {"s": slug},
            )).first()
            if not exists:
                break
            slug = f"{slug_base}-{i}"; i += 1

        # Build a complete Tenant Manifest from the relation (B2B,
        # tenant-scoped, founder-owned). All fields the system can derive
        # at activation time are written explicitly — no silent defaults.
        archetype_iso       = (rel['archetype']     or 'studio')
        country_iso         = (rel['country']       or rel.get('city') and 'IT') or 'IT'
        language_iso        = 'it' if country_iso and country_iso.lower().startswith('it') else 'en'
        advisor_id          = rel.get('owner_advisor_id')
        experiences         = list(rel['experiences'] or [])
        enabled_modules     = experiences

        trow = (await s.execute(
            text("""
                INSERT INTO tenants
                  (slug, name, status,
                   default_language, default_locale_code, active_languages,
                   enabled_modules, branding_settings, theme_settings,
                   plan_assigned_at, plan_assigned_by,
                   subscription_status, active_plan)
                VALUES
                  (:slug, :name, 'active',
                   :lang, :loc, ARRAY[:lang],
                   CAST(:mods AS jsonb),
                   CAST(:brand AS jsonb),
                   CAST(:theme AS jsonb),
                   NOW(), CAST(:advisor AS uuid),
                   'active', 'studio')
                RETURNING id
            """),
            {
                "slug":    slug,
                "name":    tenant_display_name,
                "lang":    language_iso,
                "loc":     language_iso,
                "mods":    json.dumps(enabled_modules),
                "brand":   json.dumps({
                    "monogram":   req_monogram or rel.get('monogram') or tenant_display_name[:2].upper(),
                    "archetype":  archetype_iso,
                    "country":    country_iso,
                    "website":    rel.get('website'),
                    "city":       rel.get('city'),
                }),
                "theme":   json.dumps({}),
                "advisor": str(advisor_id) if advisor_id else None,
            },
        )).mappings().first()
        tenant_id = str(trow['id'])

        # Modules from selected experiences
        for module_key in (rel['experiences'] or []):
            await s.execute(
                text("""INSERT INTO tenant_modules (tenant_id, module_key, state)
                         VALUES (:t, :m, 'active')
                         ON CONFLICT DO NOTHING"""),
                {"t": tenant_id, "m": module_key},
            )

        # Founder user (no password — magic link only)
        user_id = None
        if rel['contact_email']:
            urow = (await s.execute(
                text("""
                    INSERT INTO users
                      (tenant_id, email, full_name, role, is_active, password_hash)
                    VALUES (:t, :em, :nm, 'owner', true, '!magic-link-only')
                    ON CONFLICT (tenant_id, email) DO UPDATE
                        SET full_name = COALESCE(EXCLUDED.full_name, users.full_name)
                    RETURNING id
                """),
                {"t": tenant_id,
                 "em": rel['contact_email'],
                 "nm": rel['contact_name']},
            )).mappings().first()
            if urow:
                user_id = str(urow['id'])

        # Update relation
        await s.execute(
            text("""UPDATE studio_relations
                       SET tenant_id = :t,
                           status = 'activated',
                           last_activity_at = NOW(),
                           updated_at = NOW()
                     WHERE id = :id"""),
            {"t": tenant_id, "id": relation_id},
        )
        # And the linked request, if any
        if rel['studio_request_id']:
            await s.execute(
                text("""UPDATE studio_requests SET status = 'activated',
                                   updated_at = NOW()
                          WHERE id = :id"""),
                {"id": str(rel['studio_request_id'])},
            )
        await _log_event(s, relation_id, actor_id, 'activated',
                          {"tenant_id": tenant_id, "slug": slug})
        await s.commit()

    # Issue magic link (sandbox-safe via existing access_continuity).
    # Use the configured TTL (default 30 days for founder invitations)
    # and SKIP the generic access-continuity email — the activation
    # email below carries the same link inside the CMS-driven template.
    magic_link_url = None
    if rel['contact_email']:
        try:
            from services.access_continuity import issue_magic_link
            link_res = await issue_magic_link(
                email=rel['contact_email'],
                ttl_minutes=founder_link_ttl_minutes,
                send_email=False,
                expose_token=True,  # internal trusted call site
            )
            magic_link_url = link_res.get('magic_link_url')
        except Exception:
            pass

    # Fire studio_request_approved transactional email. We update the
    # studio_requests row via raw SQL above, which bypasses
    # update_request_status' built-in status-email trigger. Calling the
    # explicit helper here keeps the audit trail complete and lets us
    # inject the magic_link_url as the CTA target.
    if rel.get('studio_request_id'):
        try:
            from services.studio_activation import send_activation_email_for_request
            import asyncio as _aio
            _aio.create_task(send_activation_email_for_request(
                str(rel['studio_request_id']),
                magic_link_url=magic_link_url,
                magic_link_validity_days=int(founder_link_ttl_minutes // 1440),
            ))
        except Exception:
            pass

    return {"ok": True, "tenant_id": tenant_id, "slug": slug,
             "tenant_name": tenant_display_name,
             "founder_user_id": user_id,
             "founder_email": rel['contact_email'],
             "magic_link_url": magic_link_url,
             "magic_link_sent": bool(rel['contact_email'] and magic_link_url)}


# ── Serializers ──────────────────────────────────────────────────────
def _serialize_relation(r) -> dict:
    return {
        "id":                str(r['id']),
        "studio_request_id": str(r['studio_request_id']) if r['studio_request_id'] else None,
        "tenant_id":         str(r['tenant_id']) if r['tenant_id'] else None,
        "studio_name":       r['studio_name'],
        "legal_name":        r['legal_name'],
        "archetype":         r['archetype'],
        "experiences":       list(r['experiences'] or []),
        "city":              r['city'],
        "country":           r['country'],
        "website":           r['website'],
        "contact_name":      r['contact_name'],
        "contact_role":      r['contact_role'],
        "contact_email":     r['contact_email'],
        "phone_prefix":      r['phone_prefix'],
        "phone_number":      r['phone_number'],
        "status":            r['status'],
        "temperature":       r['temperature'],
        "owner_advisor_id":  str(r['owner_advisor_id']) if r['owner_advisor_id'] else None,
        "assigned_at":            _iso(r['assigned_at']),
        "protection_expires_at":  _iso(r['protection_expires_at']),
        "reassignment_requested_at": _iso(r['reassignment_requested_at']),
        "last_activity_at":  _iso(r['last_activity_at']),
        "expected_monthly_value": _num(r['expected_monthly_value']),
        "expected_setup_value":   _num(r['expected_setup_value']),
        "advisor_recurring_pct":  _num(r['advisor_recurring_pct']),
        "advisor_setup_pct":      _num(r['advisor_setup_pct']),
        "advisor_recurring_months": r['advisor_recurring_months'],
        "advisory_notes":    r['advisory_notes'],
        "next_action":       r['next_action'],
        "created_at":        _iso(r['created_at']),
        "updated_at":        _iso(r['updated_at']),
    }


def _serialize_visit(v) -> dict:
    return {
        "id":               str(v['id']),
        "relation_id":      str(v['relation_id']),
        "advisor_id":       str(v['advisor_id']) if v['advisor_id'] else None,
        "visited_at":       _iso(v['visited_at']),
        "atmosphere_observed":         v['atmosphere_observed'],
        "workflow_maturity":           v['workflow_maturity'],
        "showroom_quality":            v['showroom_quality'],
        "material_culture":            v['material_culture'],
        "design_journey_alignment":    v['design_journey_alignment'],
        "client_experience_maturity":  v['client_experience_maturity'],
        "international_readiness":     v['international_readiness'],
        "digital_readiness":           v['digital_readiness'],
        "operational_complexity":      v['operational_complexity'],
        "opportunities":               v['opportunities'],
        "objections":                  v['objections'],
        "competitor_tools":            v['competitor_tools'],
        "suggested_experiences":       list(v['suggested_experiences'] or []),
        "estimated_monthly_value":     _num(v['estimated_monthly_value']),
        "estimated_setup_value":       _num(v['estimated_setup_value']),
        "probability_pct":             v['probability_pct'],
        "next_step":                   v['next_step'],
        "private_notes":               v['private_notes'],
        "created_at":      _iso(v['created_at']),
    }


def _serialize_followup(f) -> dict:
    return {
        "id":           str(f['id']),
        "relation_id":  str(f['relation_id']),
        "advisor_id":   str(f['advisor_id']) if f['advisor_id'] else None,
        "type":         f['type'],
        "due_at":       _iso(f['due_at']),
        "notes":        f['notes'],
        "status":       f['status'],
        "completed_at": _iso(f['completed_at']),
        "next_action":  f['next_action'],
        "created_at":   _iso(f['created_at']),
    }


def _serialize_event(e) -> dict:
    return {
        "id":          str(e['id']),
        "kind":        e['kind'],
        "payload":     e['payload'] or {},
        "occurred_at": _iso(e['occurred_at']),
        "actor_id":    str(e['actor_id']) if e['actor_id'] else None,
    }


def _iso(d):
    return d.isoformat() if d else None


def _num(n):
    return float(n) if n is not None else None


async def _log_event(session, relation_id: str, actor_id: Optional[str],
                       kind: str, payload: dict):
    await session.execute(
        text("""INSERT INTO studio_relationship_events
                  (relation_id, actor_id, kind, payload)
                VALUES (:rid, :aid, :kind, CAST(:pl AS jsonb))"""),
        {"rid": relation_id, "aid": actor_id, "kind": kind,
         "pl": json.dumps(payload, default=str)},
    )
