"""Sprint G.2 · "Inizia il tuo Design Journey™" — rituale di accoglienza.

NON è una lead-capture API. È l'atto di nascita di un Design Journey.

Endpoints (PUBLIC, no auth):
  POST /api/public/journeys/initiate         → crea Account + Contact + Project + Journey
  GET  /api/public/journeys/welcome/{token}  → public-safe view del Journey appena nato
"""
from datetime import datetime, timezone
from typing import Optional, List
import secrets
import uuid

from fastapi import APIRouter, HTTPException, Body, Query, Request
from pydantic import BaseModel, EmailStr, Field

from database import db
from routers.design_journey import DEFAULT_MILESTONES

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


class InitiatePayload(BaseModel):
    tenant_slug: Optional[str] = None
    atmosphere:  Optional[AtmospherePayload] = None
    lifestyle:   Optional[LifestylePayload]  = None
    welcome:     WelcomePayload


# ─── Helpers ─────────────────────────────────────────────────────────
def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _resolve_tenant_id(client, slug: Optional[str]) -> str:
    """Resolve the tenant. Falls back to the first active tenant if slug
    missing — the welcome ritual is sometimes opened without tenant context
    (es. dalla homepage di MOOD)."""
    if slug:
        t = (client.table('tenants').select('id,status')
             .eq('slug', slug).limit(1).execute().data or [])
        if t and t[0].get('status') == 'active':
            return t[0]['id']
    # Fallback: first active tenant (the platform demo studio)
    t = (client.table('tenants').select('id')
         .eq('status', 'active').order('created_at').limit(1).execute().data or [])
    if not t:
        raise HTTPException(status_code=503, detail="No active studio available")
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
        "phone":           body.welcome.phone,
        "language":        "it",
        "locale_code":     "it",
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
        "phone":           body.welcome.phone,
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

    # 8. ITER146.A · UNIFIED Lead Pipeline observability ────────────────
    # Every public onboarding entry MUST also produce a `leads` row +
    # `funnel_events` row so the CRM has ONE canonical pipeline view,
    # regardless of whether the user arrived through /begin-journey
    # (rich design-journey chain) or /begin-partnership (Pro form).
    # Capture the SAME runtime_identity envelope as routers/leads.py
    # so audit trails are consistent across onboarding paths.
    resolved = getattr(request.state, 'resolved_tenant', None) or {}
    request_host = (request.headers.get('host') or '')
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

    # ITER146.A · Lead Pipeline Orchestration™ — fire email confirmation
    # to the private client + internal notification to the studio owner.
    # Failure NEVER blocks the journey creation.
    try:
        from services.email_service import send_template_email
        tenant_row = (c.table("tenants").select("name")
                      .eq("id", tid).limit(1).execute().data or [])
        tenant_name = tenant_row[0]["name"] if tenant_row else "MOOD for DESIGN™"
        locale = (getattr(body, "locale", None) or "it-IT").strip()

        # 1. Lead-facing confirmation
        send_template_email(
            to=email,
            template_key="lead_captured",
            context={
                "first_name":  first_name,
                "studio_name": tenant_name,
                "project_type": "design_journey",
            },
            tenant_id=tid, locale=locale,
            event_type="lead.private_client.confirmation",
            metadata={"journey_id": journey_id,
                      "onboarding_path": "begin_journey"},
        )
        # 2. Internal notifications
        owners = (c.table("users_profile")
                  .select("email, language")
                  .eq("tenant_id", tid)
                  .in_("role", ["tenant_admin", "super_admin"])
                  .limit(3).execute().data or [])
        for o in owners:
            if not o.get("email"):
                continue
            send_template_email(
                to=o["email"],
                template_key="generic",
                context={
                    "title": f"Nuovo Design Journey™ · {first_name}",
                    "body":  (f"{first_name} ({email}) ha appena iniziato "
                              f"un Design Journey. Locale: {locale}."),
                    "cta_url":   f"/workspace/projects/{project_id}",
                    "cta_label": "Apri il progetto",
                    "studio_name": tenant_name,
                },
                tenant_id=tid, locale=(o.get("language") or locale),
                event_type="lead.internal_notification",
                metadata={"journey_id": journey_id, "project_id": project_id,
                          "onboarding_path": "begin_journey"},
            )
    except Exception:
        import logging
        logging.getLogger(__name__).exception("journey email dispatch failed")

    return {
        "journey_id":    journey_id,
        "lead_id":       lead_id,
        "welcome_token": welcome_token,
        "welcome_url":   f"/journey/welcome/{welcome_token}",
        "message":       "Il tuo Design Journey è iniziato.",
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
