"""
MOOD for DESIGN — Async SQLAlchemy Database Engine
Supabase PostgreSQL via Transaction Pooler (port 6543).

Setup:
1. Add to /app/backend/.env:
   DATABASE_URL=postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres

2. Run migrations:
   cd /app/backend && alembic upgrade head

3. Seed initial data:
   python -c "from db.seed_migration import run_seed; import asyncio; asyncio.run(run_seed())"

NOTE: Without DATABASE_URL, the app falls back to in-memory seed_data.py (dev mode).
"""
import os
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

load_dotenv(Path(__file__).parent.parent / '.env')

DATABASE_URL = os.environ.get('DATABASE_URL', '')

# Only create engine if DATABASE_URL is configured
_engine = None
AsyncSessionLocal = None

if DATABASE_URL:
    # Convert to async URL for asyncpg driver
    ASYNC_DATABASE_URL = DATABASE_URL.replace('postgresql://', 'postgresql+asyncpg://')

    _engine = create_async_engine(
        ASYNC_DATABASE_URL,
        pool_size=5,
        max_overflow=3,
        pool_timeout=20,
        pool_recycle=1800,
        pool_pre_ping=False,
        echo=False,
        connect_args={
            "statement_cache_size": 0,  # CRITICAL for Supabase Transaction Pooler
            "command_timeout": 30,
        }
    )

    AsyncSessionLocal = async_sessionmaker(
        bind=_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )


class Base(DeclarativeBase):
    pass


async def get_db():
    """FastAPI dependency: get async DB session."""
    if AsyncSessionLocal is None:
        raise RuntimeError("DATABASE_URL not configured")
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


def is_db_configured() -> bool:
    """Check if Supabase database connection is configured."""
    return bool(DATABASE_URL)
