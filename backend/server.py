import sys
from pathlib import Path

ROOT_DIR = Path(__file__).parent
sys.path.insert(0, str(ROOT_DIR))

from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pydantic import BaseModel, Field, ConfigDict
from typing import List
import uuid
from datetime import datetime, timezone

load_dotenv(ROOT_DIR / '.env', override=True)

# MongoDB connection (temporary — Supabase-ready adapter in db/adapter.py)
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI(title="MOOD for DESIGN API", version="1.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")  # Ignore MongoDB's _id field
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    
    # Convert to dict and serialize datetime to ISO string for MongoDB
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks(limit: int = 100, offset: int = 0):
    # Exclude MongoDB's _id field; paginate to avoid unbounded reads.
    if limit > 500:
        limit = 500
    cursor = db.status_checks.find({}, {"_id": 0}).skip(offset).limit(limit)
    status_checks = await cursor.to_list(length=limit)
    
    # Convert ISO string timestamps back to datetime objects
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    
    return status_checks

# Include the router in the main app
app.include_router(api_router)

# Include corporate website routes
from routers.corporate import router as corporate_router
app.include_router(corporate_router, prefix="/api")

# Include media library + journal + CMS admin + AI editorial
from routers.media import router as media_router
from routers.journal import router as journal_router
from routers.cms_admin import router as cms_admin_router
from routers.ai_editorial import router as ai_editorial_router
from routers.site import router as site_router
from routers.admin_site import router as admin_site_router
from routers.auth import router as auth_router
from routers.studio_activation import router as studio_activation_router
from routers.admin_studio import router as admin_studio_router
app.include_router(media_router,        prefix="/api")
app.include_router(journal_router,      prefix="/api")
app.include_router(cms_admin_router,    prefix="/api")
app.include_router(ai_editorial_router, prefix="/api")
app.include_router(site_router,         prefix="/api")
app.include_router(admin_site_router,   prefix="/api")
app.include_router(auth_router)  # already prefixed with /api/auth
app.include_router(studio_activation_router, prefix="/api")
app.include_router(admin_studio_router,      prefix="/api")
from routers.admin_relations import router as admin_relations_router
from routers.markets import router as markets_router
from routers.tenant_activation import router as tenant_activation_router
from routers.studio_v2 import router as studio_v2_router
from routers.geo import router as geo_router
app.include_router(admin_relations_router,   prefix="/api")
app.include_router(markets_router)  # already prefixed with /api/markets
app.include_router(tenant_activation_router)  # /api/admin/tenant-activation/*
app.include_router(studio_v2_router, prefix="/api")  # /api/studio/v2/*
app.include_router(geo_router, prefix="/api")        # /api/geo/*

# M1 — Contact CRM (Command Center)
from routers.catalogs       import router as catalogs_router         # /api/catalogs/*
from routers.admin_crm      import router as admin_crm_router        # /api/admin/* (CRM)
from routers.blueprint_crm  import router as blueprint_crm_router    # /api/blueprint/*
app.include_router(catalogs_router)        # already prefixed
app.include_router(admin_crm_router)       # already prefixed
app.include_router(blueprint_crm_router)   # already prefixed

# M2 — Relationship Timeline
from routers.admin_timeline     import router as admin_timeline_router      # /api/admin/* (timeline)
from routers.blueprint_timeline import router as blueprint_timeline_router  # /api/blueprint/* (timeline)
app.include_router(admin_timeline_router)
app.include_router(blueprint_timeline_router)

# M3 — Activity Log Advanced™
from routers.admin_activities     import router as admin_activities_router      # /api/admin/* (activities v2)
from routers.blueprint_activities import router as blueprint_activities_router  # /api/blueprint/* (activities v2)
app.include_router(admin_activities_router)
app.include_router(blueprint_activities_router)

# M4 — Internal Notification Center
from routers.notifications import router as notifications_router  # /api/notifications/*
app.include_router(notifications_router)

# M4 — Background scheduler (follow-up overdue, etc.)
from jobs.scheduler import start_scheduler as _start_m4_scheduler, stop_scheduler as _stop_m4_scheduler
@app.on_event("startup")
async def _m4_scheduler_startup():
    try:
        _start_m4_scheduler()
    except Exception as _ex:
        import logging
        logging.getLogger('m4-scheduler').error('start_scheduler failed: %s', _ex)

@app.on_event("shutdown")
async def _m4_scheduler_shutdown():
    _stop_m4_scheduler()

# Ensure Supabase Storage buckets exist on startup (idempotent)
from services.storage import ensure_buckets
@app.on_event("startup")
async def _ensure_buckets():
    try:
        await ensure_buckets()
    except Exception as e:
        logging.getLogger(__name__).warning("ensure_buckets failed at startup: %s", e)


# Verify Resend integration at startup — surfaces broken email config in
# the first 5 seconds of the process life. Never raises (uses ok flag).
from services.email_dispatcher import email_health_check, log_email_health
@app.on_event("startup")
async def _email_health():
    try:
        report = await email_health_check()
        log_email_health(report)
        # Cache the report on the app state for the diagnostic endpoint
        app.state.email_health = report
    except Exception as e:
        logging.getLogger(__name__).error("email_health_check failed: %s", e)
        app.state.email_health = {'ok': False, 'detail': str(e)}


@app.get("/api/admin/email-health")
async def email_health():
    """Live diagnostic surface for the Resend integration.

    Returns the latest startup report plus the dispatch log summary
    (total / sent / failed / sandbox counts, last dispatch timestamp).
    Used by the Command Center "email diagnostic" drawer.
    """
    from sqlalchemy import text as _text
    from database import AsyncSessionLocal as _Session
    report = getattr(app.state, 'email_health', None) or await email_health_check()
    async with _Session() as s:
        agg = (await s.execute(_text("""
            SELECT
              COUNT(*)                              AS total,
              COUNT(*) FILTER (WHERE status='sent')    AS sent,
              COUNT(*) FILTER (WHERE status='failed')  AS failed,
              COUNT(*) FILTER (WHERE status='sandbox') AS sandbox,
              MAX(created_at)                       AS last_dispatch
            FROM studio_email_dispatch_log
        """))).mappings().first()
        last_err = (await s.execute(_text("""
            SELECT template_key, to_email, status, error, created_at
              FROM studio_email_dispatch_log
             WHERE status IN ('failed','sandbox')
             ORDER BY created_at DESC LIMIT 1
        """))).mappings().first()
    return {
        'integration': report,
        'dispatch': dict(agg) if agg else {},
        'last_error': dict(last_err) if last_err else None,
    }

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()