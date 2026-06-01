"""
Studio Activation Flow V2 — service layer.
─────────────────────────────────────────────────────────────────────
Wraps the existing studio_activation lifecycle behind a UX-friendly
catalog (archetypes + help topics + countries derived from markets).

NO hardcoded copy: all labels/descriptions come from editorial_blocks
namespaces `studio_v2.archetype`, `studio_v2.help`, `studio_v2.country`,
`studio_v2.ui` and fall back through the platform_languages chain.

NO duplicated pipeline: V2.submit() builds the V1-shaped fields and
delegates to studio_activation.submit_request() (single source of
truth for the email + audit + lifecycle).
"""
from __future__ import annotations
import os
from typing import Optional
from sqlalchemy import text

from database import AsyncSessionLocal
from services import studio_activation


# ── Manifest ─────────────────────────────────────────────────────────
async def manifest(locale: str = 'it-IT') -> dict:
    """Return everything the V2 funnel needs in one round-trip."""
    from tenant_resolver import get_corporate_tenant
    tenant = await get_corporate_tenant()
    tid = tenant['id']

    async with AsyncSessionLocal() as s:
        archs = (await s.execute(text("""
            SELECT code, icon_key, display_order, maps_to_archetype
              FROM studio_archetypes_v2
             WHERE is_active = TRUE
             ORDER BY display_order
        """))).mappings().all()

        topics = (await s.execute(text("""
            SELECT code, display_order
              FROM studio_help_topics
             WHERE is_active = TRUE
             ORDER BY display_order
        """))).mappings().all()

        mkts = (await s.execute(text("""
            SELECT code, display_name, countries, dial_code,
                   primary_locale, currency
              FROM markets
             WHERE active = TRUE
             ORDER BY sort_order, code
        """))).mappings().all()

        # All editorial_blocks for V2 namespaces in this locale
        copy_rows = (await s.execute(text("""
            SELECT b.namespace, b.block_key,
                   COALESCE(t.value, b.source_value) AS resolved
              FROM editorial_blocks b
              LEFT JOIN editorial_block_translations t
                ON t.block_id = b.id AND t.locale = :loc
             WHERE b.tenant_id = :tid
               AND b.is_active = TRUE
               AND b.namespace IN ('studio_v2.archetype',
                                    'studio_v2.help',
                                    'studio_v2.country',
                                    'studio_v2.ui')
        """), {"tid": tid, "loc": locale})).mappings().all()

    # Index copy by namespace + block_key
    copy: dict[str, str] = {}
    for r in copy_rows:
        copy[f"{r['namespace']}.{r['block_key']}"] = r['resolved'] or ''

    def _c(ns_key: str, fallback: str = '') -> str:
        return copy.get(ns_key, '') or fallback

    archetypes_out = [{
        "code":         a['code'],
        "icon":         a['icon_key'],
        "label":        _c(f"studio_v2.archetype.{a['code']}.label",
                           a['code'].replace('_', ' ').title()),
        "description":  _c(f"studio_v2.archetype.{a['code']}.description"),
    } for a in archs]

    help_topics_out = [{
        "code":   t['code'],
        "label":  _c(f"studio_v2.help.{t['code']}.label",
                     t['code'].replace('_', ' ').title()),
    } for t in topics]

    # Flatten markets.countries[] into a unique ISO country list
    seen: set[str] = set()
    countries_out: list[dict] = []
    for m in mkts:
        for iso in (m['countries'] or []):
            if iso in seen:
                continue
            seen.add(iso)
            countries_out.append({
                "code":      iso,
                "label":     _c(f"studio_v2.country.{iso}.label", iso),
                "dial_code": m['dial_code'],   # carried from the parent market
                "market":    m['code'],
            })
    countries_out.sort(key=lambda c: c['label'])

    # Default country = the ISO code from the most active home market matching
    # the locale; falls back to first ISO in the first active market.
    default_country = None
    locale_iso = (locale or '').split('-')[-1].upper()
    for c in countries_out:
        if c['code'] == locale_iso:
            default_country = c['code']; break
    if not default_country and mkts:
        countries_in_top = (mkts[0]['countries'] or [])
        if countries_in_top:
            default_country = countries_in_top[0]
    if not default_country and countries_out:
        default_country = countries_out[0]['code']

    return {
        "archetypes":      archetypes_out,
        "help_topics":     help_topics_out,
        "countries":       countries_out,
        "default_country": default_country,
        "ui": {
            "step1_title":       _c("studio_v2.ui.step1.title",        "Parlaci del tuo studio."),
            "step1_sublead":     _c("studio_v2.ui.step1.sublead",      "Una scelta singola."),
            "step2_title":       _c("studio_v2.ui.step2.title",        "Dove operate?"),
            "step2_market_title":   _c("studio_v2.ui.step2.market.title",   "Qual è il vostro mercato operativo principale?"),
            "step2_market_helper":  _c("studio_v2.ui.step2.market.helper",  "Lo useremo per assegnare la richiesta al team MOOD più adatto."),
            "step2_hq_title":       _c("studio_v2.ui.step2.hq.title",       "Dove ha sede il vostro studio?"),
            "step2_country":     _c("studio_v2.ui.step2.country",      "Paese"),
            "step2_city":        _c("studio_v2.ui.step2.city",         "Città"),
            "step2_targets_title":      _c("studio_v2.ui.step2.targets.title",      "Ci sono altri Paesi in cui lavorate o vorreste espandervi?"),
            "step2_targets_helper":     _c("studio_v2.ui.step2.targets.helper",     "Puoi indicare mercati attuali o futuri."),
            "step2_targets_placeholder":_c("studio_v2.ui.step2.targets.placeholder","Cerca un Paese…"),
            "step3_title":       _c("studio_v2.ui.step3.title",        "Chi sarà il referente principale?"),
            "step3_first_name":  _c("studio_v2.ui.step3.first_name",   "Nome"),
            "step3_last_name":   _c("studio_v2.ui.step3.last_name",    "Cognome"),
            "step3_email":       _c("studio_v2.ui.step3.email",        "Email professionale"),
            "step3_phone":       _c("studio_v2.ui.step3.phone",        "Telefono"),
            "step4_title":       _c("studio_v2.ui.step4.title",        "Come possiamo aiutarti?"),
            "step4_sublead":     _c("studio_v2.ui.step4.sublead",      "Multi-selezione. Almeno una opzione."),
            "step5_title":       _c("studio_v2.ui.step5.title",        "Abbiamo ricevuto la tua candidatura."),
            "step5_next_steps":  _c("studio_v2.ui.step5.next_steps",   "Prossimi passi"),
            "step5_step1":       _c("studio_v2.ui.step5.step1",        "Un MOOD Advisor esaminerà la candidatura."),
            "step5_step2":       _c("studio_v2.ui.step5.step2",        "Verrai contattato entro 3 giorni lavorativi."),
            "step5_step3":       _c("studio_v2.ui.step5.step3",        "Riceverai una email di conferma al tuo indirizzo."),
            "step5_timing":      _c("studio_v2.ui.step5.timing",       "Tempi indicativi: 7–10 giorni dalla candidatura alla configurazione del Blueprint."),
            "btn_continue":      _c("studio_v2.ui.btn.continue",       "Continua"),
            "btn_back":          _c("studio_v2.ui.btn.back",           "Indietro"),
            "btn_submit":        _c("studio_v2.ui.btn.submit",         "Invia candidatura"),
            "btn_home":          _c("studio_v2.ui.btn.home",           "Torna alla home"),
            "email_taken_user":     _c("studio_v2.ui.email.taken_user",     "Questa email è già associata a un Blueprint attivo."),
            "email_taken_advisor":  _c("studio_v2.ui.email.taken_advisor",  "Questa email appartiene a un MOOD Advisor."),
            "email_taken_pending":  _c("studio_v2.ui.email.taken_pending",  "Una candidatura per questa email è già in revisione."),
            "email_invalid":        _c("studio_v2.ui.email.invalid",        "Inserisci un indirizzo email valido."),
            "field_required":       _c("studio_v2.ui.field.required",       "Campo obbligatorio."),
            # ── P0 audit additions (2026-06-01): expose all newly seeded keys
            "step2.market.eyebrow":           _c("studio_v2.ui.step2.market.eyebrow",           "A · Mercato operativo"),
            "step2.market.label":             _c("studio_v2.ui.step2.market.label",             "Mercato MOOD"),
            "step2.hq.eyebrow":               _c("studio_v2.ui.step2.hq.eyebrow",               "B · Sede"),
            "step2.targets.eyebrow":          _c("studio_v2.ui.step2.targets.eyebrow",          "C · Paesi target · Opzionale"),
            "step2.city.placeholder":         _c("studio_v2.ui.step2.city.placeholder",         "Inserisci la città…"),
            "step2.city.placeholder_italy":   _c("studio_v2.ui.step2.city.placeholder_italy",   "Milano…"),
            "step2.city.fallback_hint":       _c("studio_v2.ui.step2.city.fallback_hint",       "Inserisci manualmente il nome della città."),
            "step2.targets.search.placeholder": _c("studio_v2.ui.step2.targets.search.placeholder", "Cerca un Paese…"),
            "step2.targets.status.active":    _c("studio_v2.ui.step2.targets.status.active",    "Già attivo"),
            "step2.targets.status.planned":   _c("studio_v2.ui.step2.targets.status.planned",   "In espansione"),
            "step2.targets.counter":          _c("studio_v2.ui.step2.targets.counter",          "{n} di {max} selezionati · La priorità è assegnata automaticamente."),
            "step2.targets.limit_reached":    _c("studio_v2.ui.step2.targets.limit_reached",    "Massimo {max} Paesi target raggiunto."),
            "step2.targets.remove_aria":      _c("studio_v2.ui.step2.targets.remove_aria",      "Rimuovi {country}"),
            "step3.email.checking":           _c("studio_v2.ui.step3.email.checking",           "Verifica in corso…"),
            "step3.email.ok":                 _c("studio_v2.ui.step3.email.ok",                 "Email disponibile."),
            "step4.help_other.placeholder":   _c("studio_v2.ui.step4.help_other.placeholder",   "Specifica…"),
            "step4.error.prefix":             _c("studio_v2.ui.step4.error.prefix",             "Si è verificato un errore"),
            "loading.brand":                  _c("studio_v2.ui.loading.brand",                  "MOOD"),
            "loading.message":                _c("studio_v2.ui.loading.message",                "Un attimo…"),
            "manifest.error":                 _c("studio_v2.ui.manifest.error",                 "Servizio temporaneamente non disponibile."),
        }
    }


# ── Email uniqueness check ───────────────────────────────────────────
async def check_email_uniqueness(email: str) -> dict:
    """
    Verify the email is not already known in any operational table.
    Returns {available: bool, reason: 'user'|'advisor'|'pending'|None}.
    """
    em = (email or '').lower().strip()
    if not em or '@' not in em or '.' not in em:
        return {"available": False, "reason": "invalid"}

    async with AsyncSessionLocal() as s:
        # 1) Existing tenant user (founder, owner, designer, client, admin)
        u = (await s.execute(text("""
            SELECT 1 FROM users
             WHERE LOWER(email) = :em
               AND COALESCE(is_active, TRUE) = TRUE
             LIMIT 1
        """), {"em": em})).first()
        if u:
            return {"available": False, "reason": "user"}

        # 2) Advisor
        a = (await s.execute(text("""
            SELECT 1 FROM advisor_profiles
             WHERE LOWER(email) = :em AND status = 'active'
             LIMIT 1
        """), {"em": em})).first()
        if a:
            return {"available": False, "reason": "advisor"}

        # 3) Pending studio_request (not yet rejected)
        r = (await s.execute(text("""
            SELECT 1 FROM studio_requests
             WHERE LOWER(contact_email) = :em
               AND status IN ('received','reviewing','contacted','qualified','activated')
             LIMIT 1
        """), {"em": em})).first()
        if r:
            return {"available": False, "reason": "pending"}

    return {"available": True, "reason": None}


# ── Submit V2 — delegates to V1 submit_request ──────────────────────
async def submit_v2(*,
    draft_token: str,
    archetype_code: str,
    # Legacy fields (kept for fallback / old clients)
    country: str = '',
    city: str | None = None,
    additional_markets: list[str] = None,
    # New geo fields (Step 2 refactor)
    primary_operating_market_code: str | None = None,
    headquarter_country_iso: str | None = None,
    headquarter_city: str | None = None,
    headquarter_region: str | None = None,
    headquarter_lat: float | None = None,
    headquarter_lng: float | None = None,
    mapbox_place_id: str | None = None,
    # target_countries: list of dicts {iso2, priority, status} OR legacy
    # list of ISO strings (kept for back-compat). Limit 3 enforced server-side.
    target_countries: list = None,
    target_country_isos: list[str] = None,
    # Contact + help
    first_name: str = '',
    last_name: str = '',
    contact_email: str = '',
    phone_prefix: str | None = None,
    phone_number: str | None = None,
    help_topics: list[str] = None,
    help_other_text: str | None = None,
    locale: str = 'it-IT',
    ip: str | None = None,
    user_agent: str | None = None,
) -> dict:
    additional_markets  = additional_markets or []
    help_topics         = help_topics or []

    # Normalize target_countries to a list of dicts with priority+status
    targets: list[dict] = []
    if target_countries:
        for i, tc in enumerate(target_countries[:3]):
            if isinstance(tc, dict):
                iso = (tc.get('iso2') or '').upper()
                if len(iso) != 2: continue
                targets.append({
                    'iso2': iso,
                    'priority': int(tc.get('priority') or (i + 1)),
                    'status':   tc.get('status') if tc.get('status') in ('active','planned') else 'planned',
                })
            else:
                iso = (str(tc) or '').upper()
                if len(iso) == 2:
                    targets.append({'iso2': iso, 'priority': i + 1, 'status': 'planned'})
    elif target_country_isos:
        for i, iso in enumerate((target_country_isos or [])[:3]):
            cl = (iso or '').upper()
            if len(cl) == 2:
                targets.append({'iso2': cl, 'priority': i + 1, 'status': 'planned'})

    # Server-side email uniqueness gate
    uniq = await check_email_uniqueness(contact_email)
    if not uniq["available"]:
        return {"ok": False, "reason": f"email_{uniq['reason']}"}

    async with AsyncSessionLocal() as s:
        arch = (await s.execute(text(
            "SELECT maps_to_archetype FROM studio_archetypes_v2 WHERE code = :c"
        ), {"c": archetype_code})).mappings().first()
        if not arch:
            return {"ok": False, "reason": "invalid_archetype"}
        v1_archetype = arch['maps_to_archetype']
        topics = (await s.execute(text("""
            SELECT code, maps_to_experience FROM studio_help_topics
             WHERE code = ANY(:codes) AND is_active = TRUE
        """), {"codes": list(help_topics)})).mappings().all()
        v1_experiences = sorted({
            t['maps_to_experience'] for t in topics if t['maps_to_experience']
        })

        operating_market_id = None
        if primary_operating_market_code:
            mkt = (await s.execute(text(
                "SELECT id FROM markets WHERE code = :c"
            ), {"c": primary_operating_market_code})).mappings().first()
            if mkt: operating_market_id = str(mkt['id'])

    final_country = (headquarter_country_iso or country or '').upper() or None
    final_city    = headquarter_city or city or None
    full_name_parts = [p for p in [first_name, last_name] if p]
    contact_name = ' '.join(full_name_parts) or None
    studio_label = contact_name

    await studio_activation.patch_draft(
        draft_token=draft_token,
        archetype=v1_archetype,
        experiences=v1_experiences,
        payload_patch={
            "studio_name":  studio_label,
            "city":         final_city,
            "country":      final_country,
            "markets":      list(additional_markets),
            "v2": {
                "archetype_code":                archetype_code,
                "primary_operating_market_code": primary_operating_market_code,
                "headquarter_region":            headquarter_region,
                "headquarter_lat":               headquarter_lat,
                "headquarter_lng":               headquarter_lng,
                "mapbox_place_id":               mapbox_place_id,
                "target_countries":              targets,
                "help_topics":                   list(help_topics),
                "help_other_text":               help_other_text or None,
                "first_name":                    first_name,
                "last_name":                     last_name,
            },
        },
        movement="contact",
        founder_email=contact_email,
    )

    res = await studio_activation.submit_request(
        draft_token=draft_token,
        contact_email=contact_email,
        contact_name=contact_name,
        contact_role=None,
        phone_prefix=phone_prefix,
        phone_number=phone_number,
        website=None, notes=None, locale=locale,
        ip=ip, user_agent=user_agent,
    )
    if not res.get('ok'):
        return res
    request_id = res['request_id']

    async with AsyncSessionLocal() as s:
        await s.execute(text("""
            UPDATE studio_requests
               SET primary_operating_market_id = CAST(:opid AS uuid),
                   headquarter_country_iso     = :hqc,
                   headquarter_region          = :hreg,
                   headquarter_lat             = :lat,
                   headquarter_lng             = :lng,
                   mapbox_place_id             = :pid
             WHERE id = :rid
        """), {"opid": operating_market_id, "hqc": final_country,
                "hreg": headquarter_region, "lat": headquarter_lat,
                "lng": headquarter_lng, "pid": mapbox_place_id,
                "rid": request_id})

        for tc in help_topics:
            await s.execute(text("""
                INSERT INTO studio_request_help_areas
                  (request_id, help_topic_code, other_text)
                VALUES (:rid, :tc, :ot)
                ON CONFLICT (request_id, help_topic_code) DO NOTHING
            """), {"rid": request_id, "tc": tc,
                   "ot": help_other_text if tc == 'other' else None})

        for t in targets:
            await s.execute(text("""
                INSERT INTO studio_request_target_countries
                  (studio_request_id, country_iso2, priority, status)
                VALUES (:rid, :iso, :pri, :st)
                ON CONFLICT (studio_request_id, country_iso2) DO UPDATE
                  SET priority = EXCLUDED.priority,
                      status   = EXCLUDED.status
            """), {"rid": request_id, "iso": t['iso2'],
                   "pri": t['priority'], "st": t['status']})
        await s.commit()
    return res


# ── Mapbox city autocomplete proxy ───────────────────────────────────
async def search_cities(query: str, country_iso: str,
                        limit: int = 5) -> list[dict]:
    """
    Forward-geocode a city query to Mapbox Places, scoped to the given
    ISO country. Returns [{name, full_name, region, lat, lng, place_id}].
    """
    token = os.environ.get('MAPBOX_ACCESS_TOKEN', '').strip()
    q = (query or '').strip()
    if not token or not q or len(q) < 2:
        return []
    import httpx, urllib.parse
    safe_q = urllib.parse.quote(q, safe='')
    url = f"https://api.mapbox.com/geocoding/v5/mapbox.places/{safe_q}.json"
    try:
        async with httpx.AsyncClient(timeout=8) as cx:
            r = await cx.get(url, params={
                "access_token":  token,
                "country":       country_iso.lower(),
                "types":         "place",
                "limit":         limit,
                "language":      "en",
                "autocomplete":  "true",
            })
            data = r.json()
            if r.status_code != 200:
                return []
    except Exception:
        return []
    out: list[dict] = []
    for f in (data.get('features') or [])[:limit]:
        center  = f.get('center') or [None, None]
        context = f.get('context') or []
        # Extract region/state from context
        region = None
        for c in context:
            cid = c.get('id', '')
            if cid.startswith('region.') or cid.startswith('district.'):
                region = c.get('text')
                break
        out.append({
            "name":      f.get('text', ''),
            "full_name": f.get('place_name', ''),
            "region":    region,
            "lng":       center[0],
            "lat":       center[1],
            "place_id":  f.get('id', ''),
        })
    return out
