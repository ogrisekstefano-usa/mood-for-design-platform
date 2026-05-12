"""MOOD for DESIGN™ — Blueprint OS API entrypoint."""
from dotenv import load_dotenv
load_dotenv()

import os
import logging
from datetime import datetime, timezone
from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware

from routers import auth, leads, projects, proposals, moodboards, inspirations, insights, settings, storage, blueprint, superadmin

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="MOOD for DESIGN™ API", version="1.0.0", docs_url="/api/docs")

cors_origins_env = os.environ.get('CORS_ORIGINS', '*')
if cors_origins_env == '*':
    app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=False,
                       allow_methods=["*"], allow_headers=["*"])
else:
    origins = [o.strip() for o in cors_origins_env.split(',')]
    app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True,
                       allow_methods=["*"], allow_headers=["*"])

api_router = APIRouter(prefix="/api")
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(leads.router, prefix="/leads", tags=["leads"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(proposals.router, prefix="/proposals", tags=["proposals"])
api_router.include_router(moodboards.router, prefix="/moodboards", tags=["moodboards"])
api_router.include_router(inspirations.router, prefix="/inspirations", tags=["inspirations"])
api_router.include_router(insights.router, prefix="/insights", tags=["insights"])
api_router.include_router(settings.router, prefix="/settings", tags=["settings"])
api_router.include_router(storage.router, prefix="/storage", tags=["storage"])
api_router.include_router(blueprint.router, prefix="/blueprint", tags=["blueprint"])
api_router.include_router(superadmin.router, prefix="/super", tags=["super-admin"])


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
