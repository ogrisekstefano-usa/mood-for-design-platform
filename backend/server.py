from dotenv import load_dotenv
load_dotenv()

import os
import logging
from datetime import datetime, timezone
from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware

from routers import auth, leads, projects, proposals, moodboards, inspirations, insights, settings, storage

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="MOOD for DESIGN™ API", version="1.0.0", docs_url="/api/docs")

# CORS — allow all for dev; set CORS_ORIGINS for production
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


@api_router.get("/health")
def health_check():
    from database import db_available
    return {
        "status": "ok",
        "platform": "MOOD for DESIGN™",
        "version": "1.0.0",
        "supabase_connected": db_available(),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@api_router.get("/")
def root():
    return {"message": "MOOD for DESIGN™ API v1.0.0"}


app.include_router(api_router)


@app.on_event("startup")
def startup():
    from database import db_available, get_db
    import bcrypt
    import uuid

    if not db_available():
        logger.warning("⚠️  Supabase not configured. Add SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to .env")
        return

    db = get_db()
    admin_email = os.environ.get('ADMIN_EMAIL', 'admin@moodfordesign.com')
    admin_password = os.environ.get('ADMIN_PASSWORD', 'Blueprint2024!')

    try:
        existing = db.table('users').select('id').eq('email', admin_email).execute()
        if not existing.data:
            tenant_id = str(uuid.uuid4())
            now = datetime.now(timezone.utc).isoformat()

            db.table('tenants').insert({
                'id': tenant_id,
                'name': 'Blueprint Studio Demo',
                'slug': 'blueprint-demo',
                'subscription_plan': 'trial',
                'settings': {},
                'feature_flags': {},
                'created_at': now,
                'updated_at': now,
            }).execute()

            hashed = bcrypt.hashpw(admin_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            db.table('users').insert({
                'id': str(uuid.uuid4()),
                'email': admin_email,
                'password_hash': hashed,
                'full_name': 'Super Admin',
                'role': 'super_admin',
                'tenant_id': tenant_id,
                'is_active': True,
                'created_at': now,
                'updated_at': now,
            }).execute()
            logger.info(f"✅ Admin seeded: {admin_email}")

            os.makedirs('/app/memory', exist_ok=True)
            with open('/app/memory/test_credentials.md', 'w') as f:
                f.write(f"""# MOOD for DESIGN™ — Test Credentials

## Super Admin
- Email: `{admin_email}`
- Password: `{admin_password}`
- Role: `super_admin`

## Auth Endpoints
- `POST /api/auth/login` — Login
- `POST /api/auth/register` — Register new tenant
- `GET /api/auth/me` — Current user
- `POST /api/auth/logout` — Logout
- `POST /api/auth/forgot-password` — Forgot password

## Demo Tenant
- Name: Blueprint Studio Demo
- Slug: blueprint-demo
""")
    except Exception as e:
        logger.warning(f"Startup seeding skipped: {e}")
