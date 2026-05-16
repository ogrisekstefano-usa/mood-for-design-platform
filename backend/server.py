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

from routers import auth, leads, projects, proposals, moodboards, inspirations, inspirations_boards, insights, settings, storage, blueprint, superadmin, pages, public, navigation, forms, workspace, moodboards_v1, templates, collab, events, storefront, onboarding, members, license as license_router, branding, domains as domains_router, demo, media, dashboard, ai_editorial, client_portal, human_assignment, tenant_onboarding, profile, client_messages, magazine

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="MOOD for DESIGN™ API", version="1.0.0", docs_url="/api/docs")

cors_origins_env = os.environ.get('CORS_ORIGINS', '')

# ── Always-allowed origins ─────────────────────────────────────────────────
# Production custom domains, Emergent native host(s), Emergent preview host,
# and local dev. These stay enabled even when CORS_ORIGINS is unset/empty,
# so production auth/CMS/storefront always work with credentials=True.
_default_origins = [
    "https://blueprint.moodfordesign.com",
    "https://moodfordesign.com",
    "https://www.moodfordesign.com",
    "https://content-hub-pro-22.emergent.host",
    "https://content-hub-pro-22.preview.emergentagent.com",
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
api_router.include_router(proposals.router, prefix="/proposals", tags=["proposals"])
api_router.include_router(moodboards.router, prefix="/moodboards", tags=["moodboards"])
api_router.include_router(moodboards_v1.router, prefix="/moodboards", tags=["moodboards-blocks"])
api_router.include_router(templates.router, prefix="/templates", tags=["templates"])
api_router.include_router(workspace.router, prefix="/workspace", tags=["workspace"])
# ORDER MATTERS: inspirations_boards (new Creative Memory System™) MUST be
# included BEFORE the legacy `inspirations` magazine router, otherwise the
# legacy `GET /{post_id}` catch-all shadows `/boards`, `/items/*`, etc.
api_router.include_router(inspirations_boards.router, prefix="/inspirations", tags=["inspirations-boards"])
api_router.include_router(inspirations.router, prefix="/inspirations", tags=["inspirations"])
api_router.include_router(insights.router, prefix="/insights", tags=["insights"])
api_router.include_router(settings.router, prefix="/settings", tags=["settings"])
api_router.include_router(storage.router, prefix="/storage", tags=["storage"])
api_router.include_router(blueprint.router, prefix="/blueprint", tags=["blueprint"])
api_router.include_router(pages.router, prefix="/blueprint", tags=["blueprint-pages"])
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
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(ai_editorial.router, prefix="/ai", tags=["ai-editorial"])
api_router.include_router(client_portal.router, prefix="/client", tags=["client-portal"])
api_router.include_router(human_assignment.router, prefix="/human-assignment", tags=["human-layer"])
api_router.include_router(tenant_onboarding.router, prefix="/tenant-onboarding", tags=["tenant-onboarding"])
api_router.include_router(profile.router, prefix="/profile", tags=["profile"])
api_router.include_router(client_messages.router, prefix="/client-messages", tags=["client-messages"])
api_router.include_router(magazine.router, prefix="/magazine", tags=["magazine"])


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
