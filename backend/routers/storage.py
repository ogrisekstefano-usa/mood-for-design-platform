import os
import uuid
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Query
from middleware.auth import get_current_user
from database import get_db, db_available
from datetime import datetime, timezone

router = APIRouter()

BUCKET_MAP = {
    'project': 'project-files',
    'moodboard': 'moodboard-assets',
    'proposal': 'proposal-files',
    'magazine': 'magazine-media',
    'tenant': 'tenant-assets',
    'export': 'exports',
}


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    bucket: str = Query('project-files'),
    reference_id: str = Query(None),
    reference_type: str = Query(None),
    current_user: dict = Depends(get_current_user)
):
    if not db_available():
        raise HTTPException(503, "Storage not configured")

    db = get_db()
    file_bytes = await file.read()
    file_ext = file.filename.split('.')[-1] if '.' in file.filename else 'bin'
    storage_filename = f"{current_user['tenant_id']}/{uuid.uuid4()}.{file_ext}"

    try:
        db.storage.from_(bucket).upload(storage_filename, file_bytes, {'content-type': file.content_type})
        public_url = db.storage.from_(bucket).get_public_url(storage_filename)
    except Exception as e:
        raise HTTPException(500, f"Upload failed: {str(e)}")

    now = datetime.now(timezone.utc).isoformat()
    file_record = {
        'id': str(uuid.uuid4()),
        'tenant_id': current_user['tenant_id'],
        'reference_id': reference_id,
        'reference_type': reference_type,
        'filename': storage_filename,
        'original_name': file.filename,
        'storage_path': storage_filename,
        'storage_bucket': bucket,
        'mime_type': file.content_type,
        'size': len(file_bytes),
        'url': public_url,
        'uploaded_by': current_user['sub'],
        'created_at': now,
    }
    db.table('files').insert(file_record).execute()

    return {"url": public_url, "filename": storage_filename, "id": file_record['id']}


@router.get("/files")
def list_files(
    reference_id: str = Query(None),
    reference_type: str = Query(None),
    current_user: dict = Depends(get_current_user)
):
    if not db_available():
        return {"data": [], "total": 0}
    db = get_db()
    q = db.table('files').select('*').eq('tenant_id', current_user['tenant_id'])
    if reference_id:
        q = q.eq('reference_id', reference_id)
    if reference_type:
        q = q.eq('reference_type', reference_type)
    result = q.order('created_at', desc=True).execute()
    return {"data": result.data, "total": len(result.data)}
