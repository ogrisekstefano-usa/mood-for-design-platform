import os
from dotenv import load_dotenv
from pathlib import Path
import logging

load_dotenv(Path(__file__).parent / '.env')
logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_SERVICE_ROLE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')

_client = None


def get_db():
    global _client
    if _client is None:
        if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
            try:
                from supabase import create_client
                _client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
                logger.info("✅ Supabase connected")
            except Exception as e:
                logger.warning(f"⚠️  Supabase connection failed: {e}")
    return _client


def db_available() -> bool:
    return get_db() is not None
