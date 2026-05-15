"""
Supabase Storage client wrapper.
Creates/manages buckets and signs/uploads files for editorial media.

Buckets (created on app startup if missing):
  - cms-assets       (public read, used for corporate + tenant CMS images)
  - journal-media    (public read, used for journal articles)
  - tenant-branding  (public read, used for logos/favicons)
"""
import os
import logging
from typing import Optional
import httpx
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent.parent / '.env')

logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ['SUPABASE_URL'].rstrip('/')
SUPABASE_SERVICE_ROLE_KEY = os.environ['SUPABASE_SERVICE_ROLE_KEY']

BUCKET_CMS_ASSETS = 'cms-assets'
BUCKET_JOURNAL_MEDIA = 'journal-media'
BUCKET_TENANT_BRANDING = 'tenant-branding'
DEFAULT_BUCKETS = [BUCKET_CMS_ASSETS, BUCKET_JOURNAL_MEDIA, BUCKET_TENANT_BRANDING]

_HEADERS = {
    "apikey": SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
}


async def ensure_buckets() -> dict:
    """Create the standard MOOD buckets if they don't exist. Idempotent."""
    async with httpx.AsyncClient(timeout=20.0) as client:
        existing = await client.get(
            f"{SUPABASE_URL}/storage/v1/bucket",
            headers=_HEADERS,
        )
        existing.raise_for_status()
        present = {b['id'] for b in existing.json()}

        results = {}
        for bucket in DEFAULT_BUCKETS:
            if bucket in present:
                results[bucket] = 'exists'
                continue
            r = await client.post(
                f"{SUPABASE_URL}/storage/v1/bucket",
                headers={**_HEADERS, "Content-Type": "application/json"},
                json={
                    "id": bucket,
                    "name": bucket,
                    "public": True,
                    "file_size_limit": 50 * 1024 * 1024,  # 50 MB
                    "allowed_mime_types": [
                        "image/jpeg", "image/png", "image/webp", "image/avif",
                        "image/gif", "image/svg+xml",
                        "video/mp4", "video/webm",
                    ],
                },
            )
            if r.status_code in (200, 201):
                results[bucket] = 'created'
            else:
                results[bucket] = f'error {r.status_code}: {r.text[:200]}'
        return results


async def upload_file(
    bucket: str,
    storage_path: str,
    file_bytes: bytes,
    content_type: str,
    upsert: bool = True,
) -> str:
    """Upload bytes to bucket/storage_path and return the public URL."""
    headers = {
        **_HEADERS,
        "Content-Type": content_type,
        "x-upsert": "true" if upsert else "false",
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(
            f"{SUPABASE_URL}/storage/v1/object/{bucket}/{storage_path}",
            headers=headers,
            content=file_bytes,
        )
        if r.status_code not in (200, 201):
            raise RuntimeError(f"Supabase upload failed {r.status_code}: {r.text[:300]}")
    return public_url(bucket, storage_path)


def public_url(bucket: str, storage_path: str) -> str:
    return f"{SUPABASE_URL}/storage/v1/object/public/{bucket}/{storage_path}"


async def delete_file(bucket: str, storage_path: str) -> bool:
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.delete(
            f"{SUPABASE_URL}/storage/v1/object/{bucket}/{storage_path}",
            headers=_HEADERS,
        )
        return r.status_code in (200, 204)
