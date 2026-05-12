"""Supabase clients + Postgres connection helpers."""
import os
import logging
from dotenv import load_dotenv
from pathlib import Path
from functools import lru_cache

load_dotenv(Path(__file__).parent / '.env')
logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_ANON_KEY = os.environ.get('SUPABASE_ANON_KEY', '')
SUPABASE_SERVICE_ROLE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
SUPABASE_JWT_SECRET = os.environ.get('SUPABASE_JWT_SECRET', '')
DATABASE_URL = os.environ.get('DATABASE_URL', '')


@lru_cache(maxsize=1)
def get_admin_client():
    """Service role client — bypasses RLS. Server-side only."""
    if not (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY):
        return None
    from supabase import create_client
    from supabase.client import ClientOptions
    try:
        # Longer timeout to mitigate transient pooler hiccups
        opts = ClientOptions(postgrest_client_timeout=30, schema='public')
        client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, options=opts)
        logger.info("✅ Supabase admin client ready")
        return client
    except Exception as e:
        logger.warning(f"Supabase admin init failed: {e}")
        return None


def db():
    """Shortcut to admin client."""
    return get_admin_client()


def db_available() -> bool:
    return get_admin_client() is not None
