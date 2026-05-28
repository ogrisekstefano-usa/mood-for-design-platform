"""
ITER160 — Studio Activation Service.

Stateless service around `studio_activation_drafts`. The flow:

  1. Client (no auth) calls POST /api/studio/activation/draft.
     If a `draft_token` is provided and matches an unfinished draft,
     that draft is returned. Otherwise a new draft + token are created.

  2. Each Movement (II / III / IV) calls PATCH …/draft with partial state.
     The service merges and bumps `updated_at` (silent autosave).

  3. POST …/complete consumes the draft and provisions the real tenant.
     (Not implemented yet — Phase 2.)

  4. GET …/manifest returns the static map of archetypes + experiences +
     pre-suggestion logic + the editorial copy keys.
"""
from __future__ import annotations

import secrets
from typing import Optional

from sqlalchemy import text

from database import AsyncSessionLocal


VALID_MOVEMENTS  = {'entrance', 'practice', 'ecosystem', 'identity', 'activate'}
VALID_ARCHETYPES = {
    'interior_studio', 'luxury_showroom', 'architecture_firm',
    'material_gallery', 'design_retail', 'stone_specialist',
}
VALID_EXPERIENCES = {
    'design_journey_os', 'material_intelligence',
    'moodboard_experience', 'showroom_continuity',
    'client_presentation_flow',
}

# Pre-suggested experiences per archetype (see PRD §4.3 / §8.1)
ARCHETYPE_TO_SUGGESTED = {
    'interior_studio':   ['design_journey_os', 'moodboard_experience', 'client_presentation_flow'],
    'luxury_showroom':   ['showroom_continuity', 'material_intelligence', 'client_presentation_flow'],
    'architecture_firm': ['design_journey_os', 'material_intelligence'],
    'material_gallery':  ['material_intelligence', 'showroom_continuity'],
    'design_retail':     ['showroom_continuity', 'client_presentation_flow'],
    'stone_specialist':  ['material_intelligence', 'showroom_continuity'],
}


def new_draft_token() -> str:
    return secrets.token_urlsafe(24)


async def get_or_create_draft(
    *,
    draft_token: Optional[str],
    ip: Optional[str],
    user_agent: Optional[str],
) -> dict:
    """
    Resume an unfinished draft if `draft_token` matches one. Otherwise
    create a fresh draft + token.
    """
    async with AsyncSessionLocal() as s:
        if draft_token:
            row = (await s.execute(
                text("""
                    SELECT id, draft_token, archetype, experiences, payload,
                           current_movement, founder_email, resumed_count,
                           created_at, updated_at, completed_at
                      FROM studio_activation_drafts
                     WHERE draft_token = :tok
                     LIMIT 1
                """),
                {"tok": draft_token},
            )).mappings().first()
            if row and not row['completed_at']:
                # Increment resumed_count silently.
                await s.execute(
                    text("UPDATE studio_activation_drafts "
                         "SET resumed_count = resumed_count + 1, updated_at = NOW() "
                         "WHERE id = :id"),
                    {"id": str(row['id'])},
                )
                await s.commit()
                return _serialize_draft(row, resumed=True)

        # Create a new draft.
        tok = new_draft_token()
        row = (await s.execute(
            text("""
                INSERT INTO studio_activation_drafts
                    (draft_token, ip, user_agent)
                VALUES (:tok, :ip, :ua)
                RETURNING id, draft_token, archetype, experiences, payload,
                          current_movement, founder_email, resumed_count,
                          created_at, updated_at, completed_at
            """),
            {"tok": tok, "ip": ip, "ua": user_agent},
        )).mappings().first()
        await s.commit()
        return _serialize_draft(row, resumed=False)


async def patch_draft(
    *,
    draft_token: str,
    archetype: Optional[str] = None,
    experiences: Optional[list[str]] = None,
    payload_patch: Optional[dict] = None,
    movement: Optional[str] = None,
    founder_email: Optional[str] = None,
) -> dict:
    """
    Merge a partial update into the draft. Unknown values are ignored
    rather than rejected (concierge intercept — never surface 4xx).
    """
    if movement is not None and movement not in VALID_MOVEMENTS:
        movement = None
    if archetype is not None and archetype not in VALID_ARCHETYPES:
        archetype = None
    if experiences is not None:
        experiences = [e for e in experiences if e in VALID_EXPERIENCES]

    async with AsyncSessionLocal() as s:
        # Look up the draft. If absent, create one — the contract is
        # always "the composition continues, never errors".
        row = (await s.execute(
            text("SELECT id, payload FROM studio_activation_drafts "
                 "WHERE draft_token = :tok LIMIT 1"),
            {"tok": draft_token},
        )).mappings().first()
        if not row:
            new = await get_or_create_draft(
                draft_token=None, ip=None, user_agent=None,
            )
            # Recurse once into the new draft.
            return await patch_draft(
                draft_token=new['draft_token'],
                archetype=archetype, experiences=experiences,
                payload_patch=payload_patch, movement=movement,
                founder_email=founder_email,
            )

        # Merge payload (deep-shallow: top-level keys are replaced).
        new_payload = dict(row['payload'] or {})
        if payload_patch:
            for k, v in payload_patch.items():
                new_payload[k] = v

        # Build dynamic UPDATE
        sets: list[str] = ["updated_at = NOW()", "payload = CAST(:payload AS jsonb)"]
        params: dict = {"id": str(row['id']),
                        "payload": _json_dump(new_payload)}
        if archetype is not None:
            sets.append("archetype = :archetype")
            params["archetype"] = archetype
        if experiences is not None:
            sets.append("experiences = :experiences")
            params["experiences"] = experiences
        if movement is not None:
            sets.append("current_movement = :movement")
            params["movement"] = movement
        if founder_email is not None:
            sets.append("founder_email = :em")
            params["em"] = founder_email.lower().strip()

        updated = (await s.execute(
            text(f"""
                UPDATE studio_activation_drafts
                   SET {', '.join(sets)}
                 WHERE id = :id
             RETURNING id, draft_token, archetype, experiences, payload,
                       current_movement, founder_email, resumed_count,
                       created_at, updated_at, completed_at
            """),
            params,
        )).mappings().first()
        await s.commit()
        return _serialize_draft(updated, resumed=False)


def manifest() -> dict:
    """
    Static map consumed by the frontend on mount — archetypes, experiences,
    pre-suggestion logic, and the editorial copy keys per movement.
    """
    BASE = ("https://ytctctmvgdkmyjrbgmqs.supabase.co/storage/v1/object/public/"
            "cms-assets/848354b9-a43e-4147-bdad-116fb93bd585/site/")
    return {
        "archetypes": [
            {
                "key": "interior_studio",
                "title_key":      "studio.activation.archetype.interior_studio.title",
                "descriptor_key": "studio.activation.archetype.interior_studio.body",
                "image_url":      BASE + "1ae982fb57-3-edited-edited.jpg",
            },
            {
                "key": "luxury_showroom",
                "title_key":      "studio.activation.archetype.luxury_showroom.title",
                "descriptor_key": "studio.activation.archetype.luxury_showroom.body",
                "image_url":      BASE + "597a6ace33-4-edited-edited.jpg",
            },
            {
                "key": "architecture_firm",
                "title_key":      "studio.activation.archetype.architecture_firm.title",
                "descriptor_key": "studio.activation.archetype.architecture_firm.body",
                "image_url":      BASE + "b949d9d0be-5-edited-edited.jpg",
            },
            {
                "key": "material_gallery",
                "title_key":      "studio.activation.archetype.material_gallery.title",
                "descriptor_key": "studio.activation.archetype.material_gallery.body",
                "image_url":      BASE + "e92596565f-2-edited-edited.jpg",
            },
            {
                "key": "design_retail",
                "title_key":      "studio.activation.archetype.design_retail.title",
                "descriptor_key": "studio.activation.archetype.design_retail.body",
                "image_url":      BASE + "51edd9748f-6-edited-edited.jpg",
            },
            {
                "key": "stone_specialist",
                "title_key":      "studio.activation.archetype.stone_specialist.title",
                "descriptor_key": "studio.activation.archetype.stone_specialist.body",
                "image_url":      BASE + "2762bad91b-7-edited-edited.jpg",
            },
        ],
        # Entrance full-bleed photograph (slow Ken-Burns drift on the page)
        "entrance_image_url": BASE + "efce52b92e-AdobeStock_1014843351.jpg",
        "archetype_to_suggested": ARCHETYPE_TO_SUGGESTED,
        "experiences": [
            {"key": "design_journey_os",
             "title_key":      "studio.activation.experience.design_journey_os.title",
             "descriptor_key": "studio.activation.experience.design_journey_os.body"},
            {"key": "material_intelligence",
             "title_key":      "studio.activation.experience.material_intelligence.title",
             "descriptor_key": "studio.activation.experience.material_intelligence.body"},
            {"key": "moodboard_experience",
             "title_key":      "studio.activation.experience.moodboard_experience.title",
             "descriptor_key": "studio.activation.experience.moodboard_experience.body"},
            {"key": "showroom_continuity",
             "title_key":      "studio.activation.experience.showroom_continuity.title",
             "descriptor_key": "studio.activation.experience.showroom_continuity.body"},
            {"key": "client_presentation_flow",
             "title_key":      "studio.activation.experience.client_presentation_flow.title",
             "descriptor_key": "studio.activation.experience.client_presentation_flow.body"},
        ],
        "copy_keys": [
            # Movement I — Entrance
            "studio.activation.entrance.eyebrow",
            "studio.activation.entrance.headline",
            "studio.activation.entrance.sublead",
            "studio.activation.entrance.cta",
            "studio.activation.entrance.return_link",
            "studio.activation.entrance.return_destination",
            # Movement II — Practice
            "studio.activation.practice.eyebrow",
            "studio.activation.practice.headline",
            "studio.activation.practice.sublead",
            "studio.activation.practice.confirm_line",
            "studio.activation.practice.continue_cta",
            "studio.activation.practice.fallback_line",
            "studio.activation.practice.fallback_link",
            # Movement III — Ecosystem
            "studio.activation.ecosystem.eyebrow",
            "studio.activation.ecosystem.headline",
            "studio.activation.ecosystem.sublead",
            "studio.activation.ecosystem.included_line",
            "studio.activation.ecosystem.exclude_line",
            "studio.activation.ecosystem.continue_cta",
            "studio.activation.ecosystem.helper",
            # Movement IV — Identity
            "studio.activation.identity.eyebrow",
            "studio.activation.identity.headline",
            "studio.activation.identity.sublead",
            "studio.activation.identity.studio_name.label",
            "studio.activation.identity.studio_name.placeholder",
            "studio.activation.identity.monogram.label",
            "studio.activation.identity.monogram.helper",
            "studio.activation.identity.where.label",
            "studio.activation.identity.where.city_placeholder",
            "studio.activation.identity.where.country_placeholder",
            "studio.activation.identity.languages.label",
            "studio.activation.identity.atelier.label",
            "studio.activation.identity.atelier.name_placeholder",
            "studio.activation.identity.atelier.role_placeholder",
            "studio.activation.identity.atelier.add",
            "studio.activation.identity.markets.label",
            "studio.activation.identity.temperament.label",
            "studio.activation.identity.temperament.helper",
            "studio.activation.identity.contact.eyebrow",
            "studio.activation.identity.contact.headline",
            "studio.activation.identity.contact.name_placeholder",
            "studio.activation.identity.contact.role_placeholder",
            "studio.activation.identity.contact.email_label",
            "studio.activation.identity.contact.email_placeholder",
            "studio.activation.identity.contact.phone_label",
            "studio.activation.identity.contact.phone_prefix_placeholder",
            "studio.activation.identity.contact.phone_number_placeholder",
            "studio.activation.identity.contact.website_label",
            "studio.activation.identity.contact.website_placeholder",
            "studio.activation.identity.contact.notes_label",
            "studio.activation.identity.contact.notes_placeholder",
            "studio.activation.identity.continue_cta",
            "studio.activation.identity.confirm_inline",
            # Movement V — Request
            "studio.activation.request.eyebrow",
            "studio.activation.request.headline",
            "studio.activation.request.body",
            "studio.activation.request.guided_intro",
            "studio.activation.request.reference_label",
            "studio.activation.request.return_cta",
            # Temperament cards
            "studio.activation.temperament.quiet.title",
            "studio.activation.temperament.quiet.body",
            "studio.activation.temperament.composed.title",
            "studio.activation.temperament.composed.body",
            "studio.activation.temperament.vivid.title",
            "studio.activation.temperament.vivid.body",
            # Markets (single source of truth)
            "studio.activation.market.private_residential",
            "studio.activation.market.hospitality",
            "studio.activation.market.cultural",
            "studio.activation.market.yacht",
            "studio.activation.market.aviation",
            "studio.activation.market.retail",
            "studio.activation.market.office",
            "studio.activation.market.showroom",
            "studio.activation.market.restaurant",
            # Roles (atelier role suggestions)
            "studio.activation.role.founder",
            "studio.activation.role.partner",
            "studio.activation.role.designer",
            "studio.activation.role.project_lead",
            "studio.activation.role.curator",
            "studio.activation.role.advisor",
            "studio.activation.role.studio_manager",
            # Languages (display labels)
            "studio.activation.language.it",
            "studio.activation.language.en-us",
            "studio.activation.language.fr",
            "studio.activation.language.de",
            "studio.activation.language.es",
            # Archetype copy
            *[f"studio.activation.archetype.{k}.title" for k in VALID_ARCHETYPES],
            *[f"studio.activation.archetype.{k}.body"  for k in VALID_ARCHETYPES],
            # Experience copy
            *[f"studio.activation.experience.{k}.title" for k in VALID_EXPERIENCES],
            *[f"studio.activation.experience.{k}.body"  for k in VALID_EXPERIENCES],
        ],
    }


# ── helpers ───────────────────────────────────────────────────────────
def _serialize_draft(row, *, resumed: bool) -> dict:
    return {
        "id":               str(row['id']),
        "draft_token":      row['draft_token'],
        "archetype":        row['archetype'],
        "experiences":      list(row['experiences'] or []),
        "payload":          row['payload'] or {},
        "current_movement": row['current_movement'],
        "founder_email":    row['founder_email'],
        "resumed_count":    row['resumed_count'],
        "resumed":          resumed,
        "created_at":       row['created_at'].isoformat() if row['created_at'] else None,
        "updated_at":       row['updated_at'].isoformat() if row['updated_at'] else None,
        "completed_at":     row['completed_at'].isoformat() if row['completed_at'] else None,
    }


def _json_dump(d) -> str:
    import json
    return json.dumps(d, default=str, ensure_ascii=False)


async def manifest_with_copy(locale: str = 'it') -> dict:
    """
    Same as `manifest()` but with `copy` map already resolved server-side
    so the frontend can render with a SINGLE network round-trip.
    """
    base = manifest()
    keys = base.get('copy_keys', [])
    # Batch-resolve in a single session call (avoid 108x session-open).
    from services.site_resolver import _fetch_block_values
    from tenant_resolver import get_corporate_tenant
    tenant = await get_corporate_tenant()
    async with AsyncSessionLocal() as session:
        values = await _fetch_block_values(session, tenant['id'], keys, locale)
    base['copy'] = {k: (values.get(k) or '') for k in keys}
    return base


# ── Final submission (Guided Introduction Request) ───────────────
VALID_TEMPERAMENTS = {'quiet', 'composed', 'vivid'}


async def submit_request(
    *,
    draft_token: str,
    contact_email: str,
    contact_name: str | None = None,
    contact_role: str | None = None,
    phone_prefix: str | None = None,
    phone_number: str | None = None,
    website: str | None = None,
    notes: str | None = None,
    locale: str = 'it',
    ip: str | None = None,
    user_agent: str | None = None,
) -> dict:
    """
    Convert a draft into a qualified `studio_requests` row. The studio
    does NOT become an active tenant. A MOOD Advisor will review the
    request and continue the conversation manually.

    Returns:
      { ok: True,  request_id: "...", reference: "MOOD-XXXX-XXXX" }
      { ok: False, reason: "empty_email" | "no_draft" | "internal" }
    """
    contact_email = (contact_email or '').lower().strip()
    if not contact_email or '@' not in contact_email:
        return {"ok": False, "reason": "empty_email"}
    if not draft_token:
        return {"ok": False, "reason": "no_draft"}

    async with AsyncSessionLocal() as s:
        drow = (await s.execute(
            text("""
                SELECT id, archetype, experiences, payload, founder_email
                  FROM studio_activation_drafts
                 WHERE draft_token = :tok
                 LIMIT 1
            """),
            {"tok": draft_token},
        )).mappings().first()
        if not drow:
            return {"ok": False, "reason": "no_draft"}

        payload = drow['payload'] or {}
        # Coerce values out of the identity payload
        studio_name = (payload.get('studio_name') or '').strip() or None
        monogram    = (payload.get('monogram')    or '').strip() or None
        city        = (payload.get('city')        or '').strip() or None
        country     = (payload.get('country')     or '').strip() or None
        languages   = payload.get('languages') or []
        atelier     = payload.get('atelier')   or []
        markets     = payload.get('markets')   or []
        temperament = payload.get('temperament')
        if temperament not in VALID_TEMPERAMENTS:
            temperament = None

        # Insert the request
        new = (await s.execute(
            text("""
                INSERT INTO studio_requests
                    (draft_id, archetype, experiences,
                     studio_name, monogram, city, country, languages,
                     atelier, markets, temperament,
                     contact_name, contact_role, contact_email,
                     phone_prefix, phone_number, website, notes,
                     locale, ip, user_agent)
                VALUES (:did, :arc, :exp,
                        :sn, :mg, :ci, :co, :langs,
                        CAST(:atelier AS jsonb), :mk, :tmp,
                        :cn, :cr, :em,
                        :pp, :ph, :ws, :nt,
                        :loc, :ip, :ua)
                RETURNING id, created_at
            """),
            {
                "did": str(drow['id']),
                "arc": drow['archetype'],
                "exp": list(drow['experiences'] or []),
                "sn": studio_name, "mg": monogram,
                "ci": city, "co": country, "langs": list(languages),
                "atelier": _json_dump(atelier),
                "mk": list(markets), "tmp": temperament,
                "cn": (contact_name or '').strip() or None,
                "cr": (contact_role or '').strip() or None,
                "em": contact_email,
                "pp": (phone_prefix or '').strip() or None,
                "ph": (phone_number or '').strip() or None,
                "ws": (website or '').strip() or None,
                "nt": (notes or '').strip() or None,
                "loc": locale, "ip": ip, "ua": user_agent,
            },
        )).mappings().first()

        # Mark the draft completed
        await s.execute(
            text("UPDATE studio_activation_drafts "
                 "   SET completed_at = NOW(), founder_email = :em, "
                 "       current_movement = 'activate', updated_at = NOW() "
                 " WHERE id = :id"),
            {"id": str(drow['id']), "em": contact_email},
        )
        await s.commit()

        request_id = str(new['id'])
        reference  = _format_reference(request_id)
        return {"ok": True, "request_id": request_id, "reference": reference}


def _format_reference(uid: str) -> str:
    """Return a human-friendly 'MOOD-XXXX-XXXX' reference from a UUID."""
    h = uid.replace('-', '').upper()
    return f"MOOD-{h[:4]}-{h[4:8]}"


# ── Admin: list requests ─────────────────────────────────────────
async def list_requests(*, status: str | None = None, limit: int = 50) -> list[dict]:
    where = ""
    params: dict = {"limit": int(limit)}
    if status:
        where = "WHERE status = :st"
        params["st"] = status
    async with AsyncSessionLocal() as s:
        rows = (await s.execute(
            text(f"""
                SELECT id, archetype, experiences, studio_name, monogram,
                       city, country, languages, markets, temperament,
                       contact_name, contact_role, contact_email,
                       phone_prefix, phone_number, website, notes,
                       locale, status, created_at, updated_at,
                       reviewed_at, advisor_notes
                  FROM studio_requests
                  {where}
                 ORDER BY created_at DESC
                 LIMIT :limit
            """),
            params,
        )).mappings().all()
    out = []
    for r in rows:
        out.append({
            "id":               str(r['id']),
            "reference":        _format_reference(str(r['id'])),
            "archetype":        r['archetype'],
            "experiences":      list(r['experiences'] or []),
            "studio_name":      r['studio_name'],
            "monogram":         r['monogram'],
            "city":             r['city'],
            "country":          r['country'],
            "languages":        list(r['languages'] or []),
            "markets":          list(r['markets'] or []),
            "temperament":      r['temperament'],
            "contact_name":     r['contact_name'],
            "contact_role":     r['contact_role'],
            "contact_email":    r['contact_email'],
            "phone_prefix":     r['phone_prefix'],
            "phone_number":     r['phone_number'],
            "website":          r['website'],
            "notes":            r['notes'],
            "locale":           r['locale'],
            "status":           r['status'],
            "created_at":       r['created_at'].isoformat() if r['created_at'] else None,
            "updated_at":       r['updated_at'].isoformat() if r['updated_at'] else None,
            "reviewed_at":      r['reviewed_at'].isoformat() if r['reviewed_at'] else None,
            "advisor_notes":    r['advisor_notes'],
        })
    return out


async def update_request_status(
    *, request_id: str, status: str | None = None,
    advisor_notes: str | None = None,
) -> bool:
    VALID = {'received', 'reviewing', 'contacted', 'qualified', 'not_aligned', 'activated'}
    if status and status not in VALID:
        return False
    sets: list[str] = ["updated_at = NOW()"]
    params: dict = {"id": request_id}
    if status is not None:
        sets.append("status = :st")
        params["st"] = status
        if status != 'received':
            sets.append("reviewed_at = COALESCE(reviewed_at, NOW())")
    if advisor_notes is not None:
        sets.append("advisor_notes = :nt")
        params["nt"] = advisor_notes
    async with AsyncSessionLocal() as s:
        r = await s.execute(
            text(f"UPDATE studio_requests SET {', '.join(sets)} "
                 "WHERE id = :id RETURNING id"),
            params,
        )
        await s.commit()
        return r.scalar() is not None
