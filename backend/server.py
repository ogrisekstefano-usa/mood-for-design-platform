"""MOOD for DESIGN™ — Blueprint OS API entrypoint."""
from dotenv import load_dotenv
load_dotenv()

import os
import time
import logging
from datetime import datetime, timezone
from fastapi import FastAPI, APIRouter, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import httpx

from routers import auth, leads, projects, proposals, moodboards, inspirations, inspirations_archive, inspirations_boards, insights, settings, storage, blueprint, superadmin, pages, public, navigation, forms, workspace, moodboards_v1, templates, collab, events, storefront, onboarding, members, license as license_router, branding, domains as domains_router, demo, media, dashboard, ai_editorial, client_portal, human_assignment, tenant_onboarding, profile, client_messages, magazine, ai_studio_brief, project_workspace_v2, proposal_composer, market_perspectives, locale_runtime, editorial_variants, advisor_suggestions, reference_intelligence, relationships, markets, editorial, advisor_network, crm_voice_notes, crm_intelligence

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="MOOD for DESIGN™ API", version="1.0.0", docs_url="/api/docs")

cors_origins_env = os.environ.get('CORS_ORIGINS', '')

# ── Always-allowed origins ─────────────────────────────────────────────────
# Production custom domains, Emergent native host(s), Emergent preview host,
# and local dev. These stay enabled even when CORS_ORIGINS is unset/empty,
# so production auth/CMS/storefront always work with credentials=True.
_default_origins = [
    # PRIMARY PLATFORM DOMAIN™ (ITER142 correction) — Blueprint Command Center
    "https://blueprint.moodfordesign.com",
    # Corporate marketing site
    "https://moodfordesign.com",
    "https://www.moodfordesign.com",
    # Preview / emergent platform endpoints
    "https://content-hub-pro-22.emergent.host",
    "https://content-hub-pro-22.preview.emergentagent.com",
    # Local dev
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

if cors_origins_env == '*':
    # Wildcard mode — used for purely public/no-cred environments. Browsers
    # disallow credentials with "*", so we drop allow_credentials here.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    # Merge env-provided origins with defaults (env wins on duplicates).
    extra = [o.strip() for o in cors_origins_env.split(',') if o.strip()]
    origins = list(dict.fromkeys(_default_origins + extra))
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["Content-Disposition"],
    )

# ITER142 · Tenant subdomain resolver — populates request.state.resolved_tenant
# for {slug}.moodfordesign.com Host headers. Mounted globally; safe (read-only).
from core.tenant_resolver import TenantResolverMiddleware  # noqa: E402
app.add_middleware(TenantResolverMiddleware)


@app.middleware("http")
async def transient_error_retry(request: Request, call_next):
    """Transparently retry once on transient Supabase HTTP/2 disconnects."""
    for attempt in range(2):
        try:
            return await call_next(request)
        except (httpx.RemoteProtocolError, httpx.ReadError, httpx.ConnectError) as e:
            if attempt == 0:
                logger.warning(f"Transient {type(e).__name__} on {request.url.path}, retrying once")
                time.sleep(0.2)
                continue
            logger.error(f"Permanent failure on {request.url.path}: {e}")
            return JSONResponse({"detail": "Upstream temporarily unavailable"}, status_code=503)

api_router = APIRouter(prefix="/api")
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(demo.router, prefix="/demo", tags=["demo"])
api_router.include_router(leads.router, prefix="/leads", tags=["leads"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(ai_studio_brief.router, tags=["ai-studio-brief"])
api_router.include_router(project_workspace_v2.router, tags=["project-workspace-v2"])
api_router.include_router(proposal_composer.router, tags=["proposal-composer"])
api_router.include_router(market_perspectives.router, tags=["market-perspectives"])
api_router.include_router(locale_runtime.router, tags=["locale-runtime"])
api_router.include_router(editorial_variants.router, tags=["editorial-variants"])
api_router.include_router(advisor_suggestions.router, tags=["advisor-suggestions"])
api_router.include_router(reference_intelligence.router, tags=["reference-intelligence"])
api_router.include_router(relationships.router, tags=["relationships"])
api_router.include_router(crm_voice_notes.router, tags=["relationships"])
# ITER148 · Phase 1 · Lead Data Model 2.0 + Closed-Question Intake
from routers import lead_intake  # noqa: E402
api_router.include_router(lead_intake.router, prefix="/relationships", tags=["relationships"])
# ITER148 · Sprint A · Relationship Engine v2 (unified catalog + answer events)
from routers import relationship_engine  # noqa: E402
api_router.include_router(relationship_engine.router, prefix="/relationships", tags=["relationships"])
# ITER148 · P0 · Client Relations™ (Lead/Prospect/Account editorial layer)
from routers import client_relations  # noqa: E402
api_router.include_router(client_relations.router, prefix="/relations", tags=["relations"])
from routers import g3_constellation  # noqa: F401  (extends crm_intelligence.router BEFORE include)
api_router.include_router(crm_intelligence.router, tags=["relationships"])
api_router.include_router(markets.router, tags=["markets"])
api_router.include_router(editorial.router, tags=["editorial"])
from routers import portfolio
from routers import editorial_calendar
from routers import market_intelligence
from routers import cultural_editions
from routers import supplier_catalogs
from routers import brands_registry
from routers import curated_references
from routers import usage_memory
from routers import client_preview
from routers import design_journey
from routers import milestone_dialogue
from routers import journey_initiate
from routers import journey_pulse
from routers import journey_step_workspace
from routers import site_evolution
from routers import journey_closure
from routers import atelier_dashboard
from routers import atelier_media
from routers import atelier_identity
api_router.include_router(portfolio.router, prefix="/portfolio", tags=["portfolio"])
api_router.include_router(proposals.router, prefix="/proposals", tags=["proposals"])
api_router.include_router(moodboards.router, prefix="/moodboards", tags=["moodboards"])
api_router.include_router(moodboards_v1.router, prefix="/moodboards", tags=["moodboards-blocks"])
api_router.include_router(templates.router, prefix="/templates", tags=["templates"])
api_router.include_router(workspace.router, prefix="/workspace", tags=["workspace"])
# ORDER MATTERS: inspirations_boards (new Creative Memory System™) MUST be
# included BEFORE the legacy `inspirations` magazine router, otherwise the
# legacy `GET /{post_id}` catch-all shadows `/boards`, `/items/*`, etc.
api_router.include_router(inspirations_boards.router, prefix="/inspirations", tags=["inspirations-boards"])
api_router.include_router(inspirations_archive.router, prefix="/inspirations", tags=["inspirations-archive"])
api_router.include_router(supplier_catalogs.router, prefix="/inspirations", tags=["supplier-catalogs"])
api_router.include_router(brands_registry.router,   prefix="/inspirations", tags=["brand-registry"])
api_router.include_router(curated_references.router, prefix="/inspirations", tags=["curated-references"])
api_router.include_router(usage_memory.router,      prefix="/inspirations", tags=["usage-memory"])
api_router.include_router(client_preview.router,    prefix="/inspirations", tags=["client-preview"])
api_router.include_router(design_journey.router,                            tags=["design-journey"])
api_router.include_router(milestone_dialogue.router,                        tags=["milestone-dialogue"])
api_router.include_router(journey_initiate.router,                          tags=["begin-journey"])
api_router.include_router(journey_pulse.router,                             tags=["dashboard-pulse"])
api_router.include_router(journey_step_workspace.router,                    tags=["journey-step-workspace"])
api_router.include_router(site_evolution.router,                            tags=["site-evolution"])
api_router.include_router(journey_closure.router,                           tags=["journey-closure"])
api_router.include_router(atelier_dashboard.router,                         tags=["atelier-dashboard"])
api_router.include_router(atelier_media.router,                             tags=["atelier-media"])
api_router.include_router(atelier_identity.router,                          tags=["atelier-identity"])
api_router.include_router(inspirations.router, prefix="/inspirations", tags=["inspirations"])
api_router.include_router(insights.router, prefix="/insights", tags=["insights"])
api_router.include_router(settings.router, prefix="/settings", tags=["settings"])
api_router.include_router(storage.router, prefix="/storage", tags=["storage"])
api_router.include_router(blueprint.router, prefix="/blueprint", tags=["blueprint"])
api_router.include_router(pages.router, prefix="/blueprint", tags=["blueprint-pages"])
# Sprint HARDENING-I18N-GUARD™: public i18n endpoint (separate from blueprint)
from routers import public_i18n  # noqa: E402
api_router.include_router(public_i18n.router, prefix="/public", tags=["public-i18n"])
# Sprint JOURNEY-TAXONOMY-I18N™: editorial taxonomy registry endpoint
from routers import taxonomy_api  # noqa: E402
api_router.include_router(taxonomy_api.router, prefix="/taxonomy", tags=["taxonomy"])
# Sprint ITER123 · Adaptive Language Experience™ — relational AI translation
from routers import ale_api  # noqa: E402
api_router.include_router(ale_api.router, prefix="/ale", tags=["adaptive-language"])
# Sprint ITER125 · Studio Voice™ — editorial language identity
from routers import voice_api  # noqa: E402
api_router.include_router(voice_api.router, prefix="/voice", tags=["studio-voice"])
# Sprint ITER127 · Language Command Center™ — runtime UI copy governance
from routers import language_api  # noqa: E402
api_router.include_router(language_api.router, prefix="/language", tags=["language-cc"])
api_router.include_router(navigation.router, prefix="/settings", tags=["navigation-footer"])
api_router.include_router(forms.router, prefix="/forms", tags=["forms"])
api_router.include_router(public.router, prefix="/public", tags=["public"])
api_router.include_router(collab.router, prefix="/collab", tags=["collab"])
api_router.include_router(events.router, prefix="/events", tags=["events"])
api_router.include_router(superadmin.router, prefix="/super", tags=["super-admin"])
api_router.include_router(storefront.router, prefix="/storefront", tags=["storefront-cms"])
api_router.include_router(members.router, prefix="/members", tags=["members"])
api_router.include_router(license_router.router, prefix="/license", tags=["licensing"])
api_router.include_router(branding.router, prefix="/branding", tags=["branding"])
api_router.include_router(domains_router.router, prefix="/domains", tags=["domains"])
api_router.include_router(onboarding.router, prefix="/onboarding", tags=["onboarding"])
api_router.include_router(media.router, prefix="/media", tags=["media-library"])
# ITER148 · Phase 2 · Media System Unificato™ · variants + Used-In + filter registry
from routers import media_system as media_system_router  # noqa: E402
api_router.include_router(media_system_router.router, prefix="/media-system", tags=["media-system"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(ai_editorial.router, prefix="/ai", tags=["ai-editorial"])
api_router.include_router(client_portal.router, prefix="/client", tags=["client-portal"])
api_router.include_router(human_assignment.router, prefix="/human-assignment", tags=["human-layer"])
api_router.include_router(tenant_onboarding.router, prefix="/tenant-onboarding", tags=["tenant-onboarding"])
api_router.include_router(profile.router, prefix="/profile", tags=["profile"])
from routers import profile_identity  # ITER147 · International Profile Identity™
api_router.include_router(profile_identity.router, prefix="/profile", tags=["profile-identity"])
api_router.include_router(client_messages.router, prefix="/client-messages", tags=["client-messages"])
# ITER150 · SPRINT A · Relationship Live Engine™
from routers import relationship_events  # noqa: E402
api_router.include_router(relationship_events.router, prefix="/relationship-engine", tags=["relationship-live"])
# ITER151 · SPRINT B · Real Conversation Engine™
from routers import relationship_conversation  # noqa: E402
api_router.include_router(relationship_conversation.router, prefix="/conversation", tags=["conversation"])
# ITER151 · SPRINT C · Orchestra · Booking + Presence + Ownership
from routers import relationship_orchestra  # noqa: E402
api_router.include_router(relationship_orchestra.router, prefix="/orchestra", tags=["orchestra"])
# ITER152 · SPRINT D · Design Direction™
from routers import design_direction  # noqa: E402
api_router.include_router(design_direction.router, prefix="/direction", tags=["direction"])
# ITER153 · SPRINT E · Studio Orchestra (Team + Notifications)
from routers import studio_orchestra  # noqa: E402
api_router.include_router(studio_orchestra.router, prefix="/orchestra-e", tags=["studio-orchestra"])
# ITER156 · Studio Pulse™ · living climate observatory
from routers import studio_pulse  # noqa: E402
api_router.include_router(studio_pulse.router, prefix="/studio-pulse", tags=["studio-pulse"])
# ITER154 · Guided Tour / Interactive Onboarding
from routers import onboarding_tour  # noqa: E402
api_router.include_router(onboarding_tour.router, prefix="/onboarding", tags=["onboarding"])
# ITER155 · Editorial Copy CMS · Surface Governance System™
from routers import editorial_copy_cms  # noqa: E402
api_router.include_router(editorial_copy_cms.router, prefix="/admin/editorial-copy", tags=["editorial-copy"])
api_router.include_router(magazine.router, prefix="/magazine", tags=["magazine"])
api_router.include_router(editorial_calendar.router, prefix="/blueprint/calendar", tags=["editorial-calendar"])
api_router.include_router(advisor_network.router, tags=["advisor-network"])
api_router.include_router(market_intelligence.router, tags=["market-intelligence"])
api_router.include_router(cultural_editions.router, tags=["cultural-editions"])
# ITER143A+ · Dynamic Editorial Runtime™ — page bundle resolver + governance.
from routers import editorial_runtime  # noqa: E402
api_router.include_router(editorial_runtime.router, prefix="/content", tags=["editorial-runtime"])
# ITER143C · Blueprint Command Center™ — ROOT SUPERADMIN governance API.
from routers import blueprint_admin  # noqa: E402
api_router.include_router(blueprint_admin.router, prefix="/blueprint-admin", tags=["blueprint-command-center"])
# ITER143E · Tenant Email Branding™ — tenant_admin-facing settings UI backend.
from routers import tenant_email_branding  # noqa: E402
api_router.include_router(tenant_email_branding.router, prefix="/tenant/email-branding", tags=["tenant-email-branding"])
# ITER143E+ · Email orchestration (webhook + retry + search + provider health).
from routers import email_orchestration  # noqa: E402
api_router.include_router(email_orchestration.router, prefix="/email", tags=["email-orchestration"])
# ITER144 · Tenant Configuration Foundation™ — runtime config + navigation + theme.
from routers import tenant_configuration  # noqa: E402
api_router.include_router(tenant_configuration.router, prefix="/tenant", tags=["tenant-configuration"])
api_router.include_router(tenant_configuration.admin_router, prefix="/blueprint-admin", tags=["blueprint-command-center"])


@api_router.get("/health")
def health_check():
    from database import db_available
    return {
        "status": "ok",
        "platform": "MOOD for DESIGN™",
        "version": "1.0.0",
        "supabase_connected": db_available(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@api_router.get("/")
def root():
    return {"message": "MOOD for DESIGN™ API"}


app.include_router(api_router)
