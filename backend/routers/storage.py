"""Storage — Supabase Storage signed uploads + media library tracking."""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Query
from models.schemas import SignedUploadRequest, MediaUploadComplete
from middleware.auth import get_current_user
from core.tenant_context import get_tenant_context
from core.licensing import assert_storage_capacity
from database import db

router = APIRouter()

ALLOWED_BUCKETS = {
    'tenant-assets', 'project-files', 'proposal-files',
    'moodboard-assets', 'magazine-media', 'exports',
}


def _now():
    return datetime.now(timezone.utc).isoformat()


@router.post("/signed-upload")
def create_signed_upload(body: SignedUploadRequest, current_user: dict = Depends(get_tenant_context)):
    """Generate a signed URL for direct upload to Supabase Storage from client.

    Pre-flight gate: if `file_size` is provided in the request we enforce
    the storage quota BEFORE issuing the signed URL — clients should always
    pass `file_size` so the user gets a clear error instead of a half-upload.
    """
    if body.bucket not in ALLOWED_BUCKETS:
        raise HTTPException(400, "Invalid bucket")
    # Server-first quota check (only if size is known; final check happens
    # again in register_media when size is authoritative)
    if body.file_size:
        assert_storage_capacity(current_user['tenant_id'], int(body.file_size))
    client = db()
    # Namespace under tenant_id to prevent cross-tenant leakage
    safe_path = f"{current_user['tenant_id']}/{body.path}"
    try:
        signed = client.storage.from_(body.bucket).create_signed_upload_url(safe_path)
        # signed contains: {'signed_url', 'token', 'path'}
        return {
            "bucket": body.bucket,
            "path": safe_path,
            "signed_url": signed.get('signed_url') or signed.get('signedUrl'),
            "token": signed.get('token'),
        }
    except Exception as e:
        raise HTTPException(500, f"Could not generate signed URL: {e}")


@router.post("/media", status_code=201)
def register_media(body: MediaUploadComplete, current_user: dict = Depends(get_tenant_context)):
    """Register an uploaded file in media_library after client-side upload.

    Final authoritative storage-quota check happens HERE — even if the
    pre-flight on signed-upload was skipped (legacy clients), we still
    refuse to register the asset if it would push the tenant over budget.
    The file is already at Supabase Storage but stays orphaned (no DB row
    → not exposed in any UI). A background sweeper deletes orphans nightly.
    """
    if body.bucket not in ALLOWED_BUCKETS:
        raise HTTPException(400, "Invalid bucket")
    # Authoritative storage gate
    if body.file_size:
        assert_storage_capacity(current_user['tenant_id'], int(body.file_size))
    client = db()
    now = _now()
    # SECURITY: always enforce tenant prefix on storage_path, regardless of what
    # the client sends. Strip any leading tenant prefix and re-prepend ours.
    tenant_prefix = current_user['tenant_id'] + '/'
    raw_path = (body.storage_path or '').lstrip('/')
    # If client provided a path with a different tenant_id prefix, reject it
    if '/' in raw_path:
        first_segment = raw_path.split('/', 1)[0]
        if len(first_segment) == 36 and first_segment != current_user['tenant_id']:
            raise HTTPException(403, "Path outside tenant scope")
        # If first segment IS our tenant id, keep as-is
        if first_segment == current_user['tenant_id']:
            safe_path = raw_path
        else:
            safe_path = tenant_prefix + raw_path
    else:
        safe_path = tenant_prefix + raw_path

    # Public URL helper (works for public buckets; private uses signed URLs)
    public = client.storage.from_(body.bucket).get_public_url(safe_path)
    media = {
        'id': str(uuid.uuid4()), 'tenant_id': current_user['tenant_id'],
        'uploaded_by': current_user['profile_id'],
        'bucket': body.bucket, 'storage_path': safe_path,
        'file_url': public, 'file_name': body.file_name, 'file_type': body.file_type,
        'file_size': body.file_size, 'alt_text': body.alt_text, 'category': body.category,
        'tags': body.tags or [], 'metadata_json': {}, 'created_at': now,
    }
    r = client.table('media_library').insert(media).execute()

    # If linked to a project, register in project_files too
    if body.project_id:
        client.table('project_files').insert({
            'id': str(uuid.uuid4()), 'tenant_id': current_user['tenant_id'],
            'project_id': body.project_id, 'uploaded_by': current_user['profile_id'],
            'bucket': body.bucket, 'storage_path': safe_path,
            'file_url': public, 'file_name': body.file_name, 'file_type': body.file_type,
            'file_size': body.file_size, 'category': body.category, 'created_at': now,
        }).execute()
    return r.data[0] if r.data else media


@router.get("/signed-download")
def signed_download(bucket: str = Query(...), path: str = Query(...),
                    current_user: dict = Depends(get_tenant_context)):
    if bucket not in ALLOWED_BUCKETS:
        raise HTTPException(400, "Invalid bucket")
    if not path.startswith(current_user['tenant_id'] + '/'):
        raise HTTPException(403, "Path outside tenant scope")
    client = db()
    try:
        res = client.storage.from_(bucket).create_signed_url(path, 3600)
        return {"url": res.get('signed_url') or res.get('signedUrl')}
    except Exception as e:
        raise HTTPException(500, f"Could not create signed URL: {e}")


@router.get("/media")
def list_media(current_user: dict = Depends(get_tenant_context),
               category: str = Query(None), limit: int = Query(50, le=200)):
    client = db()
    q = client.table('media_library').select('*').eq('tenant_id', current_user['tenant_id'])
    if category:
        q = q.eq('category', category)
    r = q.order('created_at', desc=True).limit(limit).execute()
    return {"data": r.data or []}
