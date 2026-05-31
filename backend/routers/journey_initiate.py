"""Sprint G.2 · "Inizia il tuo Design Journey™" — rituale di accoglienza.

NON è una lead-capture API. È l'atto di nascita di un Design Journey.

Endpoints (PUBLIC, no auth):
  POST /api/public/journeys/initiate         → crea Account + Contact + Project + Journey
  GET  /api/public/journeys/welcome/{token}  → public-safe view del Journey appena nato
"""
from datetime import datetime, timezone
from typing import Optional, List
import logging
import os
import secrets
import uuid

from fastapi import APIRouter, HTTPException, Body, Query, Request
from pydantic import BaseModel, EmailStr, Field

from database import db
from routers.design_journey import DEFAULT_MILESTONES

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── Models ──────────────────────────────────────────────────────────
class AtmospherePayload(BaseModel):
    space_kinds: Optional[List[str]] = None
    how_to_feel: Optional[str] = None
    references:  Optional[str] = None


class LifestylePayload(BaseModel):
    guests:     Optional[str] = None
    materials:  Optional[List[str]] = None
    ambiance:   Optional[str] = None


class WelcomePayload(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=80)
    email:      EmailStr
    phone:      Optional[str] = None
    # ITER167 R4 · Phone Country Prefix — DB-driven structured payload
    # for future routing, Chameleon™, timezone, and WhatsApp/recall logic.
    country_code:     Optional[str] = Field(default=None, max_length=2)   # ISO-3166-1 alpha-2
    dial_code:        Optional[str] = Field(default=None, max_length=8)   # "+39", "+971"
    normalized_phone: Optional[str] = Field(default=None, max_length=32)  # "+390123456789"


class InitiatePayload(BaseModel):
    tenant_slug: Optional[str] = None
    atmosphere:  Optional[AtmospherePayload] = None
    lifestyle:   Optional[LifestylePayload]  = None
    welcome:     WelcomePayload


# ─── Helpers ─────────────────────────────────────────────────────────
def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _resolve_tenant_id(client, slug: Optional[str]) -> str:
    """Resolve the tenant for an anonymous Begin Journey™ submission.

    ITER173 · Tenant Isolation Hardening Phase 1:
      - If `slug` is provided AND maps to an active tenant → use it.
      - Otherwise → use env-configured DEFAULT_PUBLIC_TENANT_SLUG.
      - If the env var is missing or its slug is not active → 503 with
        a clear message. NO silent fallback to "first tenant by
        created_at", which was fragile (ITER173 audit R3).

    The env-driven default is the canonical DEMO tenant that owns the
    public marketing site. It must be configured per environment.
    """
    # 1) Explicit slug wins
    if slug:
        t = (client.table('tenants').select('id,status')
             .eq('slug', slug).limit(1).execute().data or [])
        if t and t[0].get('status') == 'active':
            return t[0]['id']
        # Slug provided but unknown/archived → hard fail rather than mis-route.
        raise HTTPException(
            status_code=404,
            detail=f"Tenant '{slug}' is not active.",
        )

    # 2) Env-driven default (single source of truth)
    default_slug = os.environ.get('DEFAULT_PUBLIC_TENANT_SLUG')
    if not default_slug:
        logger.error(
            "DEFAULT_PUBLIC_TENANT_SLUG env var missing — refusing to "
            "silently fall back to a random tenant."
        )
        raise HTTPException(
            status_code=503,
            detail="Public tenant routing is not configured on this server.",
        )

    t = (client.table('tenants').select('id,status')
         .eq('slug', default_slug).limit(1).execute().data or [])
    if not t or t[0].get('status') != 'active':
        logger.error(
            "DEFAULT_PUBLIC_TENANT_SLUG='%s' does not resolve to an active "
            "tenant. Refusing to route anonymous journey.",
            default_slug,
        )
        raise HTTPException(
            status_code=503,
            detail="Default public tenant is not active.",
        )
    return t[0]['id']


def _compose_rationale(at: Optional[AtmospherePayload],
                        ls: Optional[LifestylePayload],
                        first_name: str) -> str:
    """Compose an italian editorial rationale from the atmosphere + lifestyle
    answers. Plain prose, mai bullet, mai marketing."""
    parts: List[str] = []
    parts.append(
        f"{first_name} apre il proprio Design Journey™ con una prima intuizione."
    )
    if at:
        if at.how_to_feel:
            parts.append(f"L'atmosfera che cerca: {at.how_to_feel.strip()}")
        if at.references:
            parts.append(f"I riferimenti che ama: {at.references.strip()}")
        if at.space_kinds:
            kinds_map = {
                "home": "la casa", "showroom": "uno showroom",
                "hospitality": "uno spazio dell'ospitalità",
                "office": "un ufficio", "other": "uno spazio dedicato",
            }
            spaces = ", ".join(kinds_map.get(k, k) for k in at.space_kinds)
            parts.append(f"Lo spazio che immagina: {spaces}.")
    if ls:
        if ls.ambiance:
            amb_map = {
                "warm_enveloping":   "caldi e avvolgenti",
                "sober_minimal":     "sobri e minimali",
                "luminous_airy":     "luminosi e arieggiati",
                "tactile_sensory":   "materici e sensoriali",
                "cinematic":         "cinematici",
            }
            parts.append(f"Il modo in cui abita: ambienti {amb_map.get(ls.ambiance, ls.ambiance)}.")
        if ls.materials:
            parts.append(f"Le materie che lo fanno stare bene: {', '.join(ls.materials)}.")
        if ls.guests:
            guests_map = {
                "often":     "riceve ospiti spesso",
                "sometimes": "qualche volta accoglie ospiti",
                "rarely":    "raramente ospita",
                "alone":     "vive lo spazio in solitudine",
            }
            parts.append(f"{first_name.capitalize()} {guests_map.get(ls.guests, ls.guests)}.")
    parts.append(
        "Da queste prime parole nasce la direzione iniziale del progetto."
    )
    return " ".join(parts)


# ─── Endpoint: initiate ──────────────────────────────────────────────
@router.post("/public/journeys/initiate", status_code=201)
def initiate_journey(request: Request, body: InitiatePayload = Body(...)):
    """Apre un Design Journey™ a partire dal rituale di accoglienza.

    Atomic: crea Account → Contact → Project → Journey → milestones →
    initial chapter → narrative events. Restituisce un welcome_token che
    consente l'accesso pubblico read-only al journey appena nato.
    """
    c = db()
    tid = _resolve_tenant_id(c, body.tenant_slug)
    first_name = body.welcome.first_name.strip()
    email = body.welcome.email.lower()

    now = _now()

    # Phone normalization (ITER167 R4): use the normalized version if
    # the frontend sent one (full E.164-style "+39…"), otherwise the raw
    # value. Country code / dial code go to metadata_json for future
    # routing (Chameleon™, timezone, WhatsApp/recall logic).
    _phone_normalized = body.welcome.normalized_phone or body.welcome.phone
    _phone_meta = {}
    if body.welcome.country_code:
        _phone_meta["country_code"] = body.welcome.country_code
    if body.welcome.dial_code:
        _phone_meta["dial_code"] = body.welcome.dial_code

    # 1. Account
    account_id = str(uuid.uuid4())
    c.table('accounts').insert({
        "id":              account_id,
        "tenant_id":       tid,
        "account_name":    first_name,
        "account_type":    "private_client",
        "lifecycle_stage": "conversation_open",
        "source":          "begin_journey_ritual",
        "email":           email,
        "phone":           _phone_normalized,
        "language":        "it",
        "locale_code":     "it",
        "country":         body.welcome.country_code,
        "metadata_json":   _phone_meta or {},
        "created_at":      now,
        "updated_at":      now,
    }).execute()

    # 2. Contact
    contact_id = str(uuid.uuid4())
    c.table('contacts').insert({
        "id":              contact_id,
        "tenant_id":       tid,
        "account_id":      account_id,
        "first_name":      first_name,
        "email":           email,
        "phone":           _phone_normalized,
        "metadata_json":   _phone_meta or {},
        "primary_contact": True,
        "lifecycle_stage": "conversation_open",
        "created_at":      now,
        "updated_at":      now,
    }).execute()

    # 3. Project (minimal)
    project_id = str(uuid.uuid4())
    project_meta = {
        "journey_origin": "begin_journey_ritual",
        "atmosphere":     (body.atmosphere.model_dump() if body.atmosphere else {}),
        "lifestyle":      (body.lifestyle.model_dump()  if body.lifestyle  else {}),
    }
    c.table('projects').insert({
        "id":            project_id,
        "tenant_id":     tid,
        "title":         f"Conversazione di {first_name}",
        "description":   "Avviata dal rituale di accoglienza · Begin Design Journey™.",
        "status":        "new",
        "language":      "it",
        "locale_code":   "it",
        "metadata_json": project_meta,
        "created_at":    now,
        "updated_at":    now,
    }).execute()

    # 4. Design Journey (with welcome_token + lifecycle_state=conversation_open)
    journey_id    = str(uuid.uuid4())
    welcome_token = secrets.token_urlsafe(24)
    c.table('design_journeys').insert({
        "id":                    journey_id,
        "tenant_id":             tid,
        "project_id":            project_id,
        "account_id":            account_id,
        "current_milestone_id":  None,
        "overall_status":        "in_progress",
        "lifecycle_state":       "conversation_open",
        "welcome_token":         welcome_token,
        "started_at":            now,
        "created_at":            now,
        "updated_at":            now,
    }).execute()

    # 5. 10 default milestones — Brief auto-started
    milestones = []
    brief_mid = None
    for idx, m in enumerate(DEFAULT_MILESTONES):
        is_brief = (m["type"] == "brief")
        mid = str(uuid.uuid4())
        if is_brief:
            brief_mid = mid
        milestones.append({
            "id":             mid,
            "journey_id":     journey_id,
            "tenant_id":      tid,
            "milestone_type": m["type"],
            "title":          m["title"],
            "description":    m["description"],
            "order_index":    idx,
            "status":         "in_progress" if is_brief else "not_started",
            "started_at":     now if is_brief else None,
            "metadata":       {"open_mode": m["open_mode"], "linked_route": m["linked_route"]},
            "created_at":     now,
            "updated_at":     now,
        })
    c.table('journey_milestones').insert(milestones).execute()
    c.table('design_journeys').update(
        {"current_milestone_id": brief_mid, "updated_at": now}
    ).eq('id', journey_id).execute()

    # 6. Initial chapter (Milestone Version on the Brief milestone)
    rationale = _compose_rationale(body.atmosphere, body.lifestyle, first_name)
    c.table('milestone_versions').insert({
        "id":           str(uuid.uuid4()),
        "tenant_id":    tid,
        "milestone_id": brief_mid,
        "chapter_kind": "initial_direction",
        "title":        "Direzione iniziale",
        "summary":      "La prima atmosfera condivisa dal cliente.",
        "rationale":    rationale,
        "created_at":   now,
        "updated_at":   now,
    }).execute()

    # 7. Two timeline events (canonical taxonomy from G.1)
    c.table('journey_timeline_events').insert([
        {
            "id":             str(uuid.uuid4()),
            "journey_id":     journey_id,
            "tenant_id":      tid,
            "milestone_id":   None,
            "event_type":     "journey_started",
            "event_canon":    "journey_created",
            "narrative_text": f"Il Design Journey™ di {first_name} ha avuto inizio. Una conversazione apre il viaggio.",
            "metadata":       {},
            "created_at":     now,
        },
        {
            "id":             str(uuid.uuid4()),
            "journey_id":     journey_id,
            "tenant_id":      tid,
            "milestone_id":   brief_mid,
            "event_type":     "milestone_started",
            "event_canon":    "brief_started",
            "narrative_text": f"Brief Cliente — in apertura. {first_name} racconta la sua atmosfera.",
            "metadata":       {},
            "created_at":     now,
        },
    ]).execute()

    # 7.5 ITER168 · Materializza journey_briefs 1:1 (root entity-aligned)
    # Cattura l'intake direttamente come entità del DJ, indipendente da `leads`.
    try:
        atmo = body.atmosphere.model_dump() if body.atmosphere else {}
        life = body.lifestyle.model_dump() if body.lifestyle else {}
        c.table('journey_briefs').insert({
            "id":                 str(uuid.uuid4()),
            "tenant_id":          tid,
            "journey_id":         journey_id,
            "closed_answers":     {"atmosphere": atmo, "lifestyle": life,
                                     "welcome": {"first_name": first_name,
                                                  "email": email}},
            "atmosphere_signals": [],
            "material_signals":   [],
            "intake_version":     "iter168_begin_journey",
            "created_at":         now,
            "updated_at":         now,
        }).execute()
    except Exception:
        import logging
        logging.getLogger(__name__).exception(
            "journey_briefs materialization failed (non-blocking)"
        )

    # 8. ITER146.A · UNIFIED Lead Pipeline observability ────────────────
    # Every public onboarding entry MUST also produce a `leads` row +
    # `funnel_events` row so the CRM has ONE canonical pipeline view,
    # regardless of whether the user arrived through /begin-journey
    # (rich design-journey chain) or /begin-partnership (Pro form).
    # Capture the SAME runtime_identity envelope as routers/leads.py
    # so audit trails are consistent across onboarding paths.
    resolved = getattr(request.state, 'resolved_tenant', None) or {}
    # ITER169 · prefer X-Forwarded-Host when present (K8s ingress rewrites
    # the internal Host header to a non-public cluster domain).
    request_host = ((request.headers.get('x-forwarded-host')
                     or request.headers.get('x-original-host')
                     or request.headers.get('host') or '').split(',')[0].strip())
    resolved_host = resolved.get('host') or request_host or None
    resolved_subdomain = resolved.get('subdomain')
    if not resolved_subdomain and request_host:
        resolved_subdomain = request_host.split(':')[0].split('.')[0] or None
    qs = dict(request.query_params)
    journey_runtime_identity = {
        "resolved_subdomain": resolved_subdomain,
        "resolved_host":      resolved_host,
        "tenant_slug":        body.tenant_slug or resolved_subdomain,
        "request_host":       request_host or None,
        "user_agent":         request.headers.get('user-agent'),
        "referer":            request.headers.get('referer'),
        "source_locale":      "it-IT",
        "onboarding_path":    "begin_journey",
        "journey_id":         journey_id,
        "project_id":         project_id,
        "account_id":         account_id,
        "atmosphere":         (body.atmosphere.model_dump() if body.atmosphere else {}),
        "lifestyle":          (body.lifestyle.model_dump()  if body.lifestyle  else {}),
        "utm": {
            "source":   qs.get("utm_source"),
            "medium":   qs.get("utm_medium"),
            "campaign": qs.get("utm_campaign"),
            "term":     qs.get("utm_term"),
            "content":  qs.get("utm_content"),
        },
    }
    lead_id = str(uuid.uuid4())
    try:
        c.table('leads').insert({
            "id":               lead_id,
            "tenant_id":        tid,
            "status":           "new",
            "source":           "begin_journey_ritual",
            "lead_type":        "private_client",
            "onboarding_path":  "begin_journey",
            "pipeline_stage":   "lead_captured",
            "first_name":       first_name,
            "email":            email,
            "phone":            body.welcome.phone,
            "language":         "it",
            "locale_code":      "it-IT",
            "runtime_identity": journey_runtime_identity,
            "metadata_json":    {"journey_id": journey_id,
                                  "project_id": project_id,
                                  "account_id": account_id},
            "created_at":       now,
            "updated_at":       now,
        }).execute()
        c.table('funnel_events').insert({
            "id":            str(uuid.uuid4()),
            "tenant_id":     tid,
            "lead_id":       lead_id,
            "stage":         "lead_captured",
            "event_name":    "begin_journey.submit",
            "metadata_json": {
                "source":          "begin_journey_ritual",
                "lead_type":       "private_client",
                "onboarding_path": "begin_journey",
                "journey_id":      journey_id,
                "project_id":      project_id,
            },
            "created_at":    now,
        }).execute()
    except Exception:
        import logging
        logging.getLogger(__name__).exception(
            "unified leads/funnel insert failed (non-blocking)"
        )

    # ITER161 · P0.2 · Lead → Prospect transition (interview completata)
    # Appena il cliente ha condiviso le prime 3 indicazioni, NON è più un lead
    # puro: ha investito tempo emotivo e ha condiviso una direzione.
    try:
        c.table("leads").update({
            "status":         "qualified",
            "pipeline_stage": "prospect_initial_brief",
            "updated_at":     now,
        }).eq("id", lead_id).execute()
        c.table("funnel_events").insert({
            "id":            str(uuid.uuid4()),
            "tenant_id":     tid,
            "lead_id":       lead_id,
            "stage":         "prospect_initial_brief",
            "event_name":    "begin_journey.prospect_promoted",
            "metadata_json": {"journey_id": journey_id,
                              "reason": "initial_brief_completed"},
            "created_at":    now,
        }).execute()
    except Exception:
        import logging
        logging.getLogger(__name__).exception("lead → prospect update failed")

    # ITER177.B · CRM Phase 1 — Discovery Interview esplicito (source=public_form)
    # Il form pubblico contiene già qualifica implicita. Per coerenza canon §4.5
    # creiamo un record discovery_interviews(qualified) audit-friendly.
    try:
        c.table("discovery_interviews").insert({
            "id":                     str(uuid.uuid4()),
            "tenant_id":              tid,
            "lead_id":                lead_id,
            "status":                 "qualified",
            "source":                 "public_form",
            "completed_at":           now,
            "qualification_signals":  {
                "auto_qualified": True,
                "source_path":    "begin_journey_ritual",
                "journey_id":     journey_id,
            },
            "metadata_json":          {
                "account_id": account_id,
                "auto":       True,
            },
            "created_at":             now,
            "updated_at":             now,
        }).execute()
    except Exception:
        import logging
        logging.getLogger(__name__).exception("discovery_interview backfill (public_form) failed")

    # ITER161 · P0.2 · Client Provisioning™ — magic link first.
    # Crea auth.user + users_profile + assignment + thread + email backup.
    # Tutto NON-blocking: se uno step accessorio fallisce, il journey è
    # comunque creato e il frontend riceve magic_link_url=null (caso degradato).
    provisioning: dict = {}
    try:
        from services.client_provisioning import provision_client_after_journey
        summary_text = rationale  # le prime indicazioni dei 3 step
        provisioning = provision_client_after_journey(
            tenant_id=tid,
            request_host=request_host or "",
            first_name=first_name,
            email=email,
            phone=body.welcome.phone,
            locale="it",
            journey_id=journey_id,
            account_id=account_id,
            lead_id=lead_id,
            summary_text=summary_text,
        )
    except Exception:
        import logging
        logging.getLogger(__name__).exception("client provisioning failed")
        provisioning = {}

    return {
        "journey_id":     journey_id,
        "lead_id":        lead_id,
        "welcome_token":  welcome_token,
        "welcome_url":    f"/journey/welcome/{welcome_token}",
        # ITER161 · primary continuity path — il frontend lo apre subito
        # in modo che il cliente entri direttamente nel Client Profile.
        "magic_link_url": provisioning.get("magic_link_url"),
        "profile_id":     provisioning.get("profile_id"),
        "assignee":       provisioning.get("assignee_profile"),
        "thread_id":      provisioning.get("thread_id"),
        "message":        "Il tuo spazio progettuale è pronto.",
    }


# ─── Endpoint: public welcome read ───────────────────────────────────
@router.get("/public/journeys/welcome/{token}")
def get_welcome(token: str):
    """Read-only public payload del Journey appena nato. NO PII oltre al
    nome di battesimo. NO tenant_id. NO storage paths."""
    c = db()
    rows = (c.table('design_journeys').select('*')
            .eq('welcome_token', token).limit(1).execute().data or [])
    if not rows:
        raise HTTPException(status_code=404, detail="Welcome non trovato")
    j = rows[0]

    # Project (per atmosphere/lifestyle reflection)
    pj = (c.table('projects').select('title,metadata_json')
          .eq('id', j['project_id']).eq('tenant_id', j['tenant_id'])
          .limit(1).execute().data or [])
    project_meta = (pj[0].get('metadata_json') or {}) if pj else {}

    # First chapter (initial_direction on Brief)
    brief = (c.table('journey_milestones').select('id,title')
             .eq('journey_id', j['id']).eq('milestone_type', 'brief')
             .limit(1).execute().data or [])
    chapter = None
    if brief:
        ver = (c.table('milestone_versions').select('chapter_kind,title,summary,rationale,created_at')
               .eq('milestone_id', brief[0]['id'])
               .order('created_at', desc=False).limit(1).execute().data or [])
        if ver:
            v = ver[0]
            chapter = {
                "kind":      v['chapter_kind'],
                "kind_label": "Direzione iniziale",
                "title":     v.get('title'),
                "summary":   v.get('summary'),
                "rationale": v.get('rationale'),
                "created_at": v.get('created_at'),
            }

    # Contact first_name (for "Benvenuto, X")
    ct = (c.table('contacts').select('first_name')
          .eq('account_id', j.get('account_id') or '')
          .eq('primary_contact', True).limit(1).execute().data or [])
    first_name = ct[0].get('first_name') if ct else None

    # Studio name (italian, no internal IDs)
    studio = (c.table('tenants').select('name,slug')
              .eq('id', j['tenant_id']).limit(1).execute().data or [])
    studio_name = studio[0]['name'] if studio else "Lo Studio"

    return {
        "first_name":     first_name,
        "atmosphere":     project_meta.get('atmosphere', {}),
        "lifestyle":      project_meta.get('lifestyle', {}),
        "journey": {
            "id":              j['id'],
            "lifecycle_state": j.get('lifecycle_state'),
            "started_at":      j.get('started_at'),
            "current_step":    "Brief Cliente",
            "milestones_count": 10,
            "first_chapter":   chapter,
        },
        "studio_name":    studio_name,
    }
