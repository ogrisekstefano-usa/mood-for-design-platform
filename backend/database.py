"""
MOOD for DESIGN — Async SQLAlchemy Database Engine (Supabase PostgreSQL)
Production: connects to Supabase via Transaction Pooler (port 6543).
DDL is owned by Blueprint migrations — this module only opens read/write sessions.
"""
import os
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

load_dotenv(Path(__file__).parent / '.env')

DATABASE_URL = os.environ['DATABASE_URL']

# Convert to asyncpg-friendly URL
_ASYNC_URL = DATABASE_URL.replace('postgresql://', 'postgresql+asyncpg://', 1)

engine = create_async_engine(
    _ASYNC_URL,
    pool_size=5,
    max_overflow=5,
    pool_timeout=20,
    pool_recycle=1800,
    pool_pre_ping=True,
    echo=False,
    connect_args={
        "statement_cache_size": 0,   # REQUIRED for Supabase Transaction Pooler (PgBouncer)
        "prepared_statement_cache_size": 0,
        "command_timeout": 30,
    },
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db():
    """FastAPI dependency: yields an async SQLAlchemy session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
